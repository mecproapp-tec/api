import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'crypto';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../storage/storage.service';
import { InvoicesPdfService } from './invoices-pdf.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private prisma: PrismaService,
    private whatsappService: WhatsappService,
    private configService: ConfigService,
    private storageService: StorageService,
    private invoicesPdfService: InvoicesPdfService,
    @InjectQueue('pdf') private pdfQueue: Queue,
  ) {}

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

  async findAll(tenantId: string, userRole?: string) {
    const where: any = {};
    if (userRole !== 'SUPER_ADMIN' && userRole !== 'ADMIN') {
      where.tenantId = tenantId;
    }
    return this.prisma.invoice.findMany({
      where,
      select: {
        id: true,
        clientId: true,
        number: true,
        total: true,
        status: true,
        pdfUrl: true,
        pdfStatus: true,
        createdAt: true,
        client: {
          select: {
            id: true,
            name: true,
            phone: true,
            vehicle: true,
            plate: true,
            address: true,
            document: true,
          },
        },
        items: {
          select: {
            id: true,
            description: true,
            quantity: true,
            price: true,
            total: true,
            issPercent: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number, tenantId: string, userRole?: string) {
    const where: any = { id };
    if (userRole !== 'SUPER_ADMIN' && userRole !== 'ADMIN') {
      where.tenantId = tenantId;
    }
    const invoice = await this.prisma.invoice.findFirst({
      where,
      select: {
        id: true,
        clientId: true,
        number: true,
        total: true,
        status: true,
        pdfUrl: true,
        pdfStatus: true,
        pdfGeneratedAt: true,
        createdAt: true,
        shareToken: true,
        shareTokenExpires: true,
        client: {
          select: {
            id: true,
            name: true,
            phone: true,
            vehicle: true,
            plate: true,
            address: true,
            document: true,
          },
        },
        items: {
          select: {
            id: true,
            description: true,
            quantity: true,
            price: true,
            total: true,
            issPercent: true,
          },
        },
      },
    });
    if (!invoice) throw new NotFoundException('Fatura não encontrada');
    return invoice;
  }

  async update(id: number, tenantId: string, updateData: any, userRole?: string) {
    await this.findOne(id, tenantId, userRole);

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

  async remove(id: number, tenantId: string, userRole?: string) {
    await this.findOne(id, tenantId, userRole);
    await this.prisma.invoiceItem.deleteMany({ where: { invoiceId: id } });
    await this.prisma.invoice.delete({ where: { id } });
    return { message: 'Fatura removida com sucesso' };
  }

  async generateShareToken(id: number, tenantId: string, userRole?: string): Promise<string> {
    this.logger.log(`generateShareToken chamado para fatura ${id}, tenantId ${tenantId}, role ${userRole}`);
    try {
      const invoice = await this.findOne(id, tenantId, userRole);
      this.logger.log(`Fatura encontrada: id=${invoice.id}, shareToken atual=${invoice.shareToken}`);

      if (
        invoice.shareToken &&
        invoice.shareTokenExpires &&
        new Date() < invoice.shareTokenExpires
      ) {
        this.logger.log(`Token existente e válido: ${invoice.shareToken}`);
        return invoice.shareToken;
      }

      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      this.logger.log(`Gerando novo token: ${token}, expira em ${expiresAt.toISOString()}`);

      await this.prisma.invoice.update({
        where: { id },
        data: {
          shareToken: token,
          shareTokenExpires: expiresAt,
        },
      });

      this.logger.log(`Token salvo com sucesso para fatura ${id}`);
      return token;
    } catch (error) {
      this.logger.error(`Erro ao gerar token para fatura ${id}:`, error.stack);
      throw new InternalServerErrorException('Erro ao gerar link de compartilhamento');
    }
  }

  async validateShareToken(token: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { shareToken: token },
      select: {
        id: true,
        tenantId: true,
        number: true,
        total: true,
        status: true,
        pdfUrl: true,
        pdfStatus: true,
        shareTokenExpires: true,
        createdAt: true,
        client: {
          select: {
            id: true,
            name: true,
            phone: true,
            vehicle: true,
            plate: true,
            address: true,
            document: true,
          },
        },
        items: {
          select: {
            description: true,
            quantity: true,
            price: true,
            total: true,
            issPercent: true,
          },
        },
      },
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
    this.logger.log(`getPdfByShareToken chamado para token: ${token}`);
    try {
      const invoice = await this.validateShareToken(token);
      this.logger.log(`Token válido para fatura ${invoice.id}`);

      const tenant = await this.prisma.tenant.findUnique({
        where: { id: invoice.tenantId },
        select: {
          name: true,
          documentNumber: true,
          phone: true,
          email: true,
          logoUrl: true,
        },
      });
      this.logger.log(`Tenant encontrado: ${tenant?.name || 'não encontrado'}`);

      // Verifica se o cliente e itens existem
      if (!invoice.client || !invoice.client.id) {
        throw new BadRequestException('Fatura sem cliente associado');
      }
      if (!invoice.items || invoice.items.length === 0) {
        throw new BadRequestException('Fatura sem itens');
      }

      // Se já tiver PDF no storage, retorna direto
      if (invoice.pdfUrl && invoice.pdfStatus === 'generated') {
        try {
          const response = await fetch(invoice.pdfUrl);
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            this.logger.log(`PDF retornado do storage, tamanho: ${arrayBuffer.byteLength}`);
            return Buffer.from(arrayBuffer);
          }
        } catch (error) {
          this.logger.warn(`Erro ao buscar PDF do storage: ${error.message}. Gerando novo.`);
        }
      }

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

      this.logger.log(`PDF gerado e salvo, tamanho: ${pdfBuffer.length}`);
      return pdfBuffer;
    } catch (error) {
      this.logger.error(`Erro em getPdfByShareToken:`, error.stack);
      if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Erro ao gerar PDF da fatura');
    }
  }

  async sendViaWhatsApp(
    id: number,
    tenantId: string,
    workshopData?: any,
    userRole?: string,
  ): Promise<{ whatsappLink?: string; message: string; pdfUrl?: string; queued?: boolean }> {
    const where: any = { id };
    if (userRole !== 'SUPER_ADMIN' && userRole !== 'ADMIN') {
      where.tenantId = tenantId;
    }
    const invoice = await this.prisma.invoice.findFirst({
      where,
      include: { client: true, items: true, tenant: true },
    });
    if (!invoice) throw new NotFoundException('Fatura não encontrada');
    const client = invoice.client;

    if (!client.phone) {
      throw new BadRequestException('Cliente sem telefone');
    }

    let token = invoice.shareToken;
    if (!token || (invoice.shareTokenExpires && new Date() > invoice.shareTokenExpires)) {
      token = await this.generateShareToken(invoice.id, tenantId, userRole);
    }

    const apiBase = (process.env.API_URL || process.env.APP_URL || 'https://api.mecpro.tec.br').replace(/\/api$/, '');
    const pdfUrl = `${apiBase}/api/public/invoices/share/${token}`;

    const message = this.buildWhatsAppMessage(invoice, pdfUrl);
    const whatsappLink = this.whatsappService.generateWhatsAppLink(client.phone, message);

    return { whatsappLink, message, pdfUrl };
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