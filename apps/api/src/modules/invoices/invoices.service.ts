import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';

import { PrismaService } from '../../shared/prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'crypto';

import { WhatsappService } from '../whatsapp/whatsapp.service';
import { InvoicesPdfService } from './invoices-pdf.service';
import { StorageService } from '../storage/storage.service';

import { InvoiceStatus, ShareType } from '@prisma/client';

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private prisma: PrismaService,
    private whatsappService: WhatsappService,
    private invoicesPdfService: InvoicesPdfService,
    private storageService: StorageService,
  ) {}

  // ============================
  // CALCULO
  // ============================
  private calculate(items: any[]) {
    let total = 0;

    const normalized = items.map((item) => {
      const price = Number(item.price) || 0;
      const quantity = Number(item.quantity) || 1;
      const iss = item.issPercent
        ? price * (item.issPercent / 100)
        : 0;

      const itemTotal = (price + iss) * quantity;

      total += itemTotal;

      return {
        description: item.description,
        quantity,
        price,
        issPercent: item.issPercent,
        total: itemTotal,
      };
    });

    return { items: normalized, total };
  }

  // ============================
  // CREATE
  // ============================
  async create(tenantId: string, data: any) {
    if (!data.items?.length) {
      throw new BadRequestException('Fatura sem itens');
    }

    const { items, total } = this.calculate(data.items);

    const invoice = await this.prisma.invoice.create({
      data: {
        tenantId,
        clientId: data.clientId,
        number: `INV-${uuidv4().slice(0, 8).toUpperCase()}`,
        total,
        status: 'PENDING',
        items: { create: items },
      },
      include: {
        items: true,
        client: true,
        tenant: true,
      },
    });

    return invoice;
  }

  // ============================
  // LISTAGEM
  // ============================
  async findAll(tenantId: string, role?: string) {
    const where: any = {};

    if (!['ADMIN', 'SUPER_ADMIN'].includes(role || '')) {
      where.tenantId = tenantId;
    }

    return this.prisma.invoice.findMany({
      where,
      include: { client: true, items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number, tenantId: string, role?: string) {
    const where: any = { id };

    if (!['ADMIN', 'SUPER_ADMIN'].includes(role || '')) {
      where.tenantId = tenantId;
    }

    const invoice = await this.prisma.invoice.findFirst({
      where,
      include: {
        client: true,
        items: true,
        tenant: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Fatura não encontrada');
    }

    return invoice;
  }

  // ============================
  // UPDATE / DELETE
  // ============================
  async update(id: number, tenantId: string, data: any, role?: string) {
    await this.findOne(id, tenantId, role);

    return this.prisma.invoice.update({
      where: { id },
      data: {
        clientId: data.clientId,
        status: data.status as InvoiceStatus,
      },
      include: { client: true, items: true },
    });
  }

  async remove(id: number, tenantId: string, role?: string) {
    await this.findOne(id, tenantId, role);

    return this.prisma.invoice.delete({
      where: { id },
    });
  }

  // ============================
  // SHARE TOKEN
  // ============================
  async generateShareToken(id: number) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
    });

    if (!invoice) {
      throw new NotFoundException('Fatura não encontrada');
    }

    const token = randomBytes(32).toString('hex');

    await this.prisma.publicShare.create({
      data: {
        token,
        type: ShareType.INVOICE,
        resourceId: id,
        tenantId: invoice.tenantId,
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });

    return token;
  }

  // ============================
  // 🔥 NOVO - BUSCAR FATURA PELO TOKEN
  // ============================
  async getInvoiceByShareToken(token: string) {
    const share = await this.prisma.publicShare.findFirst({
      where: { token },
    });

    if (!share) {
      throw new UnauthorizedException('Token inválido');
    }

    if (share.expiresAt && new Date() > share.expiresAt) {
      throw new UnauthorizedException('Token expirado');
    }

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: share.resourceId },
      include: {
        client: true,
        items: true,
        tenant: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Fatura não encontrada');
    }

    return invoice;
  }

  // ============================
  // 📲 WHATSAPP (ATUALIZADO)
  // ============================
  async sendViaWhatsApp(id: number) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { client: true, items: true, tenant: true },
    });

    if (!invoice) throw new NotFoundException('Fatura não encontrada');
    if (!invoice.client.phone)
      throw new BadRequestException('Cliente sem telefone');

    const baseUrl =
      (process.env.API_URL || 'https://api.mecpro.tec.br').replace(/\/$/, '');

    const token = await this.generateShareToken(invoice.id);

    const publicUrl = `${baseUrl}/public/invoices/share/${token}`;

    const message = `Olá ${invoice.client.name}!

📄 Sua fatura está pronta

💰 Total: R$ ${invoice.total.toFixed(2)}

👉 ${publicUrl}`;

    const whatsappLink =
      this.whatsappService.generateWhatsAppLink(
        invoice.client.phone,
        message,
      );

    return { whatsappLink };
  }
}