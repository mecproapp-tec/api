import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'crypto';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { StorageService } from '../storage/storage.service';
import { InvoicesPdfService } from './invoices-pdf.service';

@Injectable()
export class InvoicesService implements OnModuleInit {
  private readonly logger = new Logger(InvoicesService.name);
  private redisAvailable = true;

  constructor(
    private prisma: PrismaService,
    private whatsappService: WhatsappService,
    private configService: ConfigService,
    private storageService: StorageService,
    private invoicesPdfService: InvoicesPdfService,
    @InjectQueue('pdf-invoice') private pdfQueue: Queue,
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

  async create(tenantId: string, data: any) {
    if (!data.items || data.items.length === 0) {
      throw new BadRequestException('A fatura deve ter pelo menos um item.');
    }

    const client = await this.prisma.client.findFirst({
      where: { id: data.clientId, tenantId },
    });

    if (!client) {
      throw new NotFoundException('Cliente não encontrado');
    }

    const itemsWithTotal = data.items.map((item) => {
      const iss = item.issPercent ? item.price * (item.issPercent / 100) : 0;
      const total = (item.price + iss) * item.quantity;
      return {
        description: item.description,
        quantity: item.quantity,
        price: item.price,
        issPercent: item.issPercent,
        total,
      };
    });

    const total = itemsWithTotal.reduce((acc, item) => acc + item.total, 0);
    const invoiceNumber = `INV-${uuidv4().slice(0, 8).toUpperCase()}`;

    return this.prisma.invoice.create({
      data: {
        tenantId,
        clientId: data.clientId,
        number: invoiceNumber,
        total,
        status: data.status || 'PENDING',
        items: { create: itemsWithTotal },
      },
      include: { items: true, client: true },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.invoice.findMany({
      where: { tenantId },
      include: { items: true, client: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number, tenantId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, tenantId },
      include: { items: true, client: true },
    });

    if (!invoice) throw new NotFoundException('Fatura não encontrada');
    return invoice;
  }

  async update(id: number, tenantId: string, updateData: any) {
    await this.findOne(id, tenantId);

    if (updateData.clientId) {
      const client = await this.prisma.client.findFirst({
        where: { id: updateData.clientId, tenantId },
      });
      if (!client) throw new NotFoundException('Cliente não encontrado');
    }

    if (updateData.items && updateData.items.length > 0) {
      await this.prisma.invoiceItem.deleteMany({ where: { invoiceId: id } });

      const itemsWithTotal = updateData.items.map((item) => {
        const iss = item.issPercent ? item.price * (item.issPercent / 100) : 0;
        const total = (item.price + iss) * item.quantity;
        return {
          description: item.description,
          quantity: item.quantity,
          price: item.price,
          issPercent: item.issPercent,
          total,
        };
      });

      const total = itemsWithTotal.reduce((acc, item) => acc + item.total, 0);

      const dataToUpdate: any = {
        clientId: updateData.clientId,
        total,
        items: { create: itemsWithTotal },
      };
      if (updateData.status) dataToUpdate.status = updateData.status;

      return this.prisma.invoice.update({
        where: { id },
        data: dataToUpdate,
        include: { items: true, client: true },
      });
    }

    const dataToUpdate: any = {};
    if (updateData.clientId) dataToUpdate.clientId = updateData.clientId;
    if (updateData.status) dataToUpdate.status = updateData.status;

    return this.prisma.invoice.update({
      where: { id },
      data: dataToUpdate,
      include: { items: true, client: true },
    });
  }

  async remove(id: number, tenantId: string) {
    await this.findOne(id, tenantId);
    await this.prisma.invoiceItem.deleteMany({ where: { invoiceId: id } });
    await this.prisma.invoice.delete({ where: { id } });
    return { message: 'Fatura removida com sucesso' };
  }

  async generateShareToken(id: number, tenantId: string): Promise<string> {
    const invoice = await this.findOne(id, tenantId);

    if (
      invoice.shareToken &&
      invoice.shareTokenExpires &&
      new Date() < invoice.shareTokenExpires
    ) {
      return invoice.shareToken;
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.invoice.update({
      where: { id },
      data: {
        shareToken: token,
        shareTokenExpires: expiresAt,
      },
    });

    return token;
  }

  async validateShareToken(token: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { shareToken: token },
      include: { items: true, client: true },
    });

    if (!invoice) {
      throw new UnauthorizedException('Token inválido');
    }
    if (invoice.shareTokenExpires && new Date() > invoice.shareTokenExpires) {
      throw new UnauthorizedException('Token expirado');
    }
    return invoice;
  }

  async getPdfByShareToken(token: string): Promise<Buffer> {
    const invoice = await this.validateShareToken(token);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: invoice.tenantId },
    });

    if (!invoice.pdfUrl || invoice.pdfStatus !== 'generated') {
      const pdfBuffer = await this.invoicesPdfService.generateInvoicePdf(invoice, tenant);
      const key = `${invoice.tenantId}/invoices/${invoice.id}.pdf`;
      const url = await this.storageService.upload(pdfBuffer, key);

      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          pdfUrl: url,
          pdfStatus: 'generated',
          pdfGeneratedAt: new Date(),
        },
      });

      return pdfBuffer;
    } else {
      const response = await fetch(invoice.pdfUrl);
      if (!response.ok) throw new Error('Erro ao buscar PDF do storage');
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }
  }

  async sendViaWhatsApp(
    id: number,
    tenantId: string,
  ): Promise<{ whatsappLink?: string; message: string; pdfUrl?: string; queued?: boolean }> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, tenantId },
      include: { client: true, items: true, tenant: true },
    });
    if (!invoice) throw new NotFoundException('Fatura não encontrada');
    const client = invoice.client;

    if (!client.phone) {
      throw new BadRequestException('Cliente sem telefone');
    }

    if (invoice.pdfUrl && invoice.pdfStatus === 'generated') {
      const pdfUrl = invoice.pdfUrl;
      const message = this.buildWhatsAppMessage(invoice, pdfUrl);
      const whatsappLink = this.whatsappService.generateWhatsAppLink(client.phone, message);
      return {
        whatsappLink,
        message,
        pdfUrl,
      };
    }

    const tenant = invoice.tenant;
    const invoiceData = {
      ...invoice,
      items: invoice.items,
      client: invoice.client,
    };

    if (!this.redisAvailable) {
      this.logger.warn(`Redis indisponível: gerando PDF síncrono para fatura ${id}`);
      try {
        const pdfBuffer = await this.invoicesPdfService.generateInvoicePdf(invoiceData, tenant);
        const key = `${tenantId}/invoices/${id}.pdf`;
        const url = await this.storageService.upload(pdfBuffer, key);

        await this.prisma.invoice.update({
          where: { id, tenantId },
          data: {
            pdfUrl: url,
            pdfStatus: 'generated',
            pdfGeneratedAt: new Date(),
          },
        });

        const message = this.buildWhatsAppMessage(invoice, url);
        const whatsappLink = this.whatsappService.generateWhatsAppLink(client.phone, message);
        return {
          whatsappLink,
          message,
          pdfUrl: url,
        };
      } catch (error) {
        this.logger.error(`Falha ao gerar PDF síncrono para fatura ${id}`, error);
        throw new BadRequestException('Erro ao gerar PDF. Tente novamente mais tarde.');
      }
    }

    await this.pdfQueue.add('generate-invoice-pdf', {
      tenantId,
      invoiceId: id,
      tenantData: tenant,
      invoiceData,
    });

    if (!invoice.pdfStatus || invoice.pdfStatus === 'failed') {
      await this.prisma.invoice.update({
        where: { id, tenantId },
        data: { pdfStatus: 'pending' },
      });
    }

    return {
      message: 'PDF em processamento. O link será enviado em breve.',
      queued: true,
    };
  }

  private buildWhatsAppMessage(invoice: any, pdfUrl: string): string {
    const client = invoice.client;
    return `Olá ${client.name}!

Sua fatura ${invoice.number} está pronta ✅

🔗 Acesse aqui:
${pdfUrl}

💰 Total: R$ ${invoice.total.toFixed(2)}
📌 Status: ${this.getStatusText(invoice.status)}`;
  }

  private getStatusText(status: string): string {
    const map = {
      PAID: 'Paga',
      PENDING: 'Pendente',
      CANCELED: 'Cancelada',
    };
    return map[status] || 'Desconhecido';
  }
}