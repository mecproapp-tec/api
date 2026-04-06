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
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InvoiceStatus, ShareType } from '@prisma/client';

type PdfResult =
  | { pdfUrl: string }
  | { generating: true };

interface InvoiceItemInput {
  description: string;
  price: number;
  quantity: number;
  issPercent?: number;
}

interface CreateInvoiceDto {
  clientId: number;
  items: InvoiceItemInput[];
}

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private prisma: PrismaService,
    private whatsappService: WhatsappService,
    @InjectQueue('pdf') private pdfQueue: Queue,
  ) {}

  private calculate(items: InvoiceItemInput[]) {
    let total = 0;

    const normalized = items.map((item) => {
      if (!item.description) {
        throw new BadRequestException('Item sem descrição');
      }

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

  async create(tenantId: string, data: CreateInvoiceDto) {
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
      include: { items: true, client: true, tenant: true },
    });

    await this.pdfQueue.add('generate-pdf', {
      tenantId,
      entityId: invoice.id,
      entityType: 'invoice',
      data: invoice,
    });

    return invoice;
  }

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
      include: { client: true, items: true },
    });

    if (!invoice) {
      throw new NotFoundException('Fatura não encontrada');
    }

    return invoice;
  }

  async update(
    id: number,
    tenantId: string,
    data: Partial<CreateInvoiceDto> & { status?: string },
    role?: string,
  ) {
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
        pdfUrl: '',
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });

    return token;
  }

  async getPdfByShareToken(token: string): Promise<PdfResult> {
    const share = await this.prisma.publicShare.findUnique({
      where: { token },
    });

    if (!share) {
      throw new UnauthorizedException('Token inválido');
    }

    if (share.type !== ShareType.INVOICE) {
      throw new UnauthorizedException('Tipo inválido');
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

    if (invoice.pdfUrl) {
      await this.prisma.publicShare.update({
        where: { token },
        data: { pdfUrl: invoice.pdfUrl },
      });

      return { pdfUrl: invoice.pdfUrl };
    }

    await this.pdfQueue.add('generate-pdf', {
      tenantId: invoice.tenantId,
      entityId: invoice.id,
      entityType: 'invoice',
      data: invoice,
    });

    return { generating: true };
  }

  async sendViaWhatsApp(id: number) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        client: true,
        items: true,
        tenant: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Fatura não encontrada');
    }

    if (!invoice.client.phone) {
      throw new BadRequestException('Cliente sem telefone');
    }

    const token = await this.generateShareToken(id);

    const frontendBase =
      process.env.FRONTEND_URL || 'https://mecpro.tec.br';

    const link = `${frontendBase}/share/${token}`;

    const message = `Olá ${invoice.client.name}!

Sua fatura está pronta ✅

📄 Visualizar:
${link}

💰 Total: R$ ${invoice.total.toFixed(2)}`;

    return {
      whatsappLink: this.whatsappService.generateWhatsAppLink(
        invoice.client.phone,
        message,
      ),
      pdfUrl: invoice.pdfUrl,
      publicLink: link,
      queued: true,
    };
  }
}