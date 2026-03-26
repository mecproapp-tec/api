import { Injectable, NotFoundException, BadRequestException, UnauthorizedException, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { EstimateStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { EstimatesPdfService } from './estimates-pdf.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../storage/storage.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class EstimatesService implements OnModuleInit {
  private readonly logger = new Logger(EstimatesService.name);
  private redisAvailable = true;

  constructor(
    private prisma: PrismaService,
    private estimatesPdfService: EstimatesPdfService,
    private whatsappService: WhatsappService,
    private configService: ConfigService,
    private storageService: StorageService,
    @InjectQueue('pdf-estimate') private pdfQueue: Queue,
  ) {}

  async onModuleInit() {
    await this.checkRedisConnection();
  }

  private async checkRedisConnection() {
    try {
      const client = this.pdfQueue.client;
      await client.ping();
      this.logger.log('Redis disponível para filas');
      this.redisAvailable = true;
    } catch (error) {
      this.logger.error(`Redis indisponível: ${error.message}. Usando fallback síncrono.`);
      this.redisAvailable = false;
    }
  }

  async create(tenantId: string, data: { clientId: number; date: string; items: any[] }) {
    const client = await this.prisma.client.findFirst({
      where: { id: data.clientId, tenantId },
    });
    if (!client) throw new NotFoundException('Cliente não encontrado');

    if (!data.items || data.items.length === 0) {
      throw new BadRequestException('Orçamento deve ter pelo menos um item.');
    }

    const total = data.items.reduce((acc, item) => {
      const itemTotal = item.price * (item.quantity || 1);
      const iss = item.issPercent ? itemTotal * (item.issPercent / 100) : 0;
      return acc + itemTotal + iss;
    }, 0);

    const estimate = await this.prisma.estimate.create({
      data: {
        tenantId,
        clientId: data.clientId,
        date: new Date(data.date),
        total,
        status: EstimateStatus.DRAFT,
        items: {
          create: data.items.map((item) => ({
            description: item.description,
            quantity: item.quantity || 1,
            price: item.price,
            total: item.price * (item.quantity || 1),
            issPercent: item.issPercent,
          })),
        },
      },
      include: { items: true, client: true },
    });
    return estimate;
  }

  async findAll(tenantId: string) {
    return this.prisma.estimate.findMany({
      where: { tenantId },
      include: { items: true, client: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number, tenantId: string) {
    const estimate = await this.prisma.estimate.findFirst({
      where: { id, tenantId },
      include: { items: true, client: true },
    });
    if (!estimate) throw new NotFoundException('Orçamento não encontrado');
    return estimate;
  }

  async update(id: number, tenantId: string, data: { clientId: number; date: string; items: any[]; status?: string }) {
    await this.findOne(id, tenantId);
    await this.prisma.estimateItem.deleteMany({ where: { estimateId: id } });

    const total = data.items.reduce((acc, item) => {
      const itemTotal = item.price * (item.quantity || 1);
      const iss = item.issPercent ? itemTotal * (item.issPercent / 100) : 0;
      return acc + itemTotal + iss;
    }, 0);

    let status: EstimateStatus | undefined;
    if (data.status) {
      const statusMap: Record<string, EstimateStatus> = {
        pending: EstimateStatus.DRAFT,
        accepted: EstimateStatus.APPROVED,
        converted: EstimateStatus.CONVERTED,
        DRAFT: EstimateStatus.DRAFT,
        APPROVED: EstimateStatus.APPROVED,
        CONVERTED: EstimateStatus.CONVERTED,
      };
      status = statusMap[data.status];
      if (!status) {
        throw new BadRequestException(`Status inválido: ${data.status}`);
      }
    }

    return this.prisma.estimate.update({
      where: { id },
      data: {
        clientId: data.clientId,
        date: new Date(data.date),
        total,
        status: status,
        items: {
          create: data.items.map((item) => ({
            description: item.description,
            quantity: item.quantity || 1,
            price: item.price,
            total: item.price * (item.quantity || 1),
            issPercent: item.issPercent,
          })),
        },
      },
      include: { items: true, client: true },
    });
  }

  async remove(id: number, tenantId: string) {
    await this.findOne(id, tenantId);
    await this.prisma.estimateItem.deleteMany({ where: { estimateId: id } });
    await this.prisma.estimate.delete({ where: { id } });
    return { message: 'Orçamento removido com sucesso' };
  }

  async generateShareToken(id: number, tenantId: string): Promise<string> {
    const estimate = await this.findOne(id, tenantId);
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.estimate.update({
      where: { id },
      data: {
        shareToken: token,
        shareTokenExpires: expiresAt,
      },
    });

    return token;
  }

  async validateShareToken(token: string) {
    const estimate = await this.prisma.estimate.findFirst({
      where: { shareToken: token },
      include: { items: true, client: true },
    });
    if (!estimate) {
      throw new UnauthorizedException('Token inválido');
    }
    if (estimate.shareTokenExpires && new Date() > estimate.shareTokenExpires) {
      throw new UnauthorizedException('Token expirado');
    }
    return estimate;
  }

  async getPdfByShareToken(token: string): Promise<Buffer> {
    const estimate = await this.validateShareToken(token);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: estimate.tenantId },
    });
    try {
      const pdf = await this.estimatesPdfService.generateEstimatePdf(estimate, tenant);
      return pdf;
    } catch (err) {
      throw err;
    }
  }

  async sendViaWhatsApp(
    id: number,
    tenantId: string,
  ): Promise<{ whatsappLink?: string; message: string; pdfUrl?: string; queued?: boolean }> {
    const estimate = await this.prisma.estimate.findFirst({
      where: { id, tenantId },
      include: { client: true, items: true, tenant: true },
    });
    if (!estimate) throw new NotFoundException('Orçamento não encontrado');
    const client = estimate.client;

    if (!client.phone) {
      throw new BadRequestException('Cliente não possui telefone cadastrado');
    }

    if (estimate.pdfUrl && estimate.pdfStatus === 'generated') {
      const pdfUrl = estimate.pdfUrl;
      const message = this.buildWhatsAppMessage(estimate, pdfUrl);
      const whatsappLink = this.whatsappService.generateWhatsAppLink(client.phone, message);
      return {
        whatsappLink,
        message,
        pdfUrl,
      };
    }

    const tenant = estimate.tenant;
    const estimateData = {
      ...estimate,
      items: estimate.items,
      client: estimate.client,
    };

    if (!this.redisAvailable) {
      this.logger.warn(`Redis indisponível: gerando PDF síncrono para orçamento ${id}`);
      try {
        const pdfBuffer = await this.estimatesPdfService.generateEstimatePdf(estimateData, tenant);
        const key = `${tenantId}/estimates/${id}.pdf`;
        const url = await this.storageService.upload(pdfBuffer, key);

        await this.prisma.estimate.update({
          where: { id, tenantId },
          data: {
            pdfUrl: url,
            pdfStatus: 'generated',
            pdfGeneratedAt: new Date(),
          },
        });

        const message = this.buildWhatsAppMessage(estimate, url);
        const whatsappLink = this.whatsappService.generateWhatsAppLink(client.phone, message);
        return {
          whatsappLink,
          message,
          pdfUrl: url,
        };
      } catch (error) {
        this.logger.error(`Falha ao gerar PDF síncrono para orçamento ${id}`, error);
        throw new BadRequestException('Erro ao gerar PDF. Tente novamente mais tarde.');
      }
    }

    await this.pdfQueue.add('generate-estimate-pdf', {
      tenantId,
      estimateId: id,
      tenantData: tenant,
      estimateData,
    });

    if (!estimate.pdfStatus || estimate.pdfStatus === 'failed') {
      await this.prisma.estimate.update({
        where: { id, tenantId },
        data: { pdfStatus: 'pending' },
      });
    }

    return {
      message: 'PDF em processamento. O link será enviado em breve.',
      queued: true,
    };
  }

  private buildWhatsAppMessage(estimate: any, pdfUrl: string): string {
    const client = estimate.client;
    return `Olá ${client.name}!

Seu orçamento está pronto ✅

🔗 Acesse aqui:
${pdfUrl}

👤 Cliente: ${client.name}
🚗 Veículo: ${client.vehicle || 'Não informado'}
💰 Total: R$ ${estimate.total.toFixed(2)}
📌 Status: ${estimate.status === 'DRAFT' ? 'Pendente' : estimate.status === 'APPROVED' ? 'Aceito' : 'Convertido'}`;
  }
}