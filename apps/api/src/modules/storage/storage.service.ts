import { Injectable, Logger, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private s3: S3Client;
  private bucket: string;
  private publicUrl: string;

  constructor() {
    this.bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME!;
    this.publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL!;

    if (
      !this.bucket ||
      !this.publicUrl ||
      !process.env.CLOUDFLARE_R2_ENDPOINT ||
      !process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ||
      !process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
    ) {
      throw new Error('❌ R2 não configurado corretamente no .env');
    }

    this.s3 = new S3Client({
      region: 'auto',
      endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: true,
    });
    this.logger.log(`✅ R2 conectado: bucket ${this.bucket}`);
  }

  async uploadPdf(buffer: Buffer, key: string): Promise<string> {
    if (!buffer || buffer.length === 0) {
      throw new InternalServerErrorException('Buffer inválido');
    }

    if (!key.toLowerCase().includes('.pdf')) {
      throw new InternalServerErrorException(
        'Key inválida: precisa terminar com .pdf (ex: pasta/arquivo.pdf)',
      );
    }

    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: 'application/pdf',
        }),
      );

      const url = `${this.publicUrl}/${key}`;
      this.logger.log(`✅ Upload R2 OK: ${url} (${buffer.length} bytes)`);
      return url;
    } catch (error) {
      this.logger.error(`❌ Erro no upload R2: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Falha no upload: ${error.message}`);
    }
  }

  async getFile(key: string): Promise<Buffer> {
    try {
      const response = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      const stream = response.Body as import('stream').Readable;

      return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', (err) => {
          stream.destroy();
          reject(err);
        });
      });
    } catch (error) {
      this.logger.error(`❌ Erro ao buscar arquivo: ${key}`, error);
      throw new NotFoundException('Arquivo não encontrado');
    }
  }

  async deleteFile(key: string): Promise<void> {
    try {
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      this.logger.log(`✅ Arquivo deletado: ${key}`);
    } catch (error) {
      this.logger.error(`❌ Erro ao deletar arquivo: ${key}`, error);
      throw new InternalServerErrorException(`Falha ao deletar: ${error.message}`);
    }
  }
}