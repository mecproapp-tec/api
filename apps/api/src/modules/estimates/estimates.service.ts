import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { randomBytes } from 'crypto';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { EstimatesPdfService } from './estimates-pdf.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class EstimatesService {
  private readonly logger = new Logger(EstimatesService.name);

  constructor(
    private prisma: PrismaService,
    private whatsappService: WhatsappService,
    private estimatesPdfService: EstimatesPdfService,
    private storageService: StorageService,
  ) {}

  private calculateItems(items: any[]) {
    let total = 0;
    const normalized = items.map((item) => {
      const price = Number(item.price) || 0;
      const quantity = Number(item.quantity) || 1;
      const iss = item.issPercent ? price * (item.issPercent / 100) : 0;
      const itemTotal = (price + iss) * quantity;
      total += itemTotal;
      return {
        description: item.description,
        price,
        quantity,
        issPercent: item.issPercent,
        total: itemTotal,
      };
    });
    return { items: normalized, total };
  }

  async create(tenantId: string, data: any) {
    if (!data.items?.length) {
      throw new BadRequestException('Orçamento sem itens');
    }

    const client = await this.prisma.client.findFirst({
      where: { id: data.clientId, tenantId },
    });
    if (!client) throw new NotFoundException('Cliente não encontrado');

    const { items, total } = this.calculateItems(data.items);

    const estimate = await this.prisma.estimate.create({
      data: {
        tenantId,
        clientId: data.clientId,
        date: new Date(data.date),
        total,
        status: 'DRAFT',
        items: { create: items },
      },
      include: { items: true, client: true, tenant: true },
    });

    try {
      const pdfBuffer = await this.estimatesPdfService.generateEstimatePdf(estimate, estimate.tenant);
      const pdfUrl = await this.storageService.uploadPdf(pdfBuffer, `${tenantId}/estimates/${estimate.id}.pdf`);
      await this.prisma.estimate.update({
        where: { id: estimate.id },
        data: { pdfUrl, pdfKey: `${tenantId}/estimates/${estimate.id}.pdf` },
      });
      this.logger.log(`✅ Orçamento ${estimate.id} criado com PDF: ${pdfUrl}`);
    } catch (error) {
      this.logger.error(`❌ Falha ao gerar/upload PDF para orçamento ${estimate.id}`, error);
    }

    return estimate;
  }

  async findAll(tenantId: string, role?: string) {
    const where: any = {};
    if (!['ADMIN', 'SUPER_ADMIN'].includes(role || '')) {
      where.tenantId = tenantId;
    }
    return this.prisma.estimate.findMany({
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
    const estimate = await this.prisma.estimate.findFirst({
      where,
      include: { client: true, items: true, tenant: true },
    });
    if (!estimate) throw new NotFoundException('Orçamento não encontrado');
    return estimate;
  }

  async update(id: number, tenantId: string, data: any, role?: string) {
    await this.findOne(id, tenantId, role);
    const { items, total } = this.calculateItems(data.items);
    return this.prisma.estimate.update({
      where: { id },
      data: {
        clientId: data.clientId,
        date: new Date(data.date),
        total,
        status: data.status || 'DRAFT',
        items: { deleteMany: {}, create: items },
      },
      include: { client: true, items: true },
    });
  }

  async remove(id: number, tenantId: string, role?: string) {
    await this.findOne(id, tenantId, role);
    return this.prisma.estimate.delete({ where: { id } });
  }

  async generateShareToken(id: number, tenantId: string, role?: string) {
    const estimate = await this.findOne(id, tenantId, role);
    if (estimate.shareToken && estimate.shareTokenExpires && new Date() < estimate.shareTokenExpires) {
      return estimate.shareToken;
    }
    const token = randomBytes(32).toString('hex');
    await this.prisma.estimate.update({
      where: { id },
      data: { shareToken: token, shareTokenExpires: new Date(Date.now() + 7 * 86400000) },
    });
    return token;
  }

  async getPdfByShareToken(token: string) {
    const estimate = await this.prisma.estimate.findFirst({
      where: { shareToken: token },
      include: { client: true, items: true, tenant: true },
    });
    if (!estimate) throw new UnauthorizedException('Token inválido');
    if (estimate.shareTokenExpires && new Date() > estimate.shareTokenExpires) {
      throw new UnauthorizedException('Token expirado');
    }
    if (estimate.pdfUrl) {
      return { pdfUrl: estimate.pdfUrl };
    }
    const pdfBuffer = await this.estimatesPdfService.generateEstimatePdf(estimate, estimate.tenant);
    const pdfUrl = await this.storageService.uploadPdf(pdfBuffer, `${estimate.tenantId}/estimates/${estimate.id}.pdf`);
    await this.prisma.estimate.update({
      where: { id: estimate.id },
      data: { pdfUrl, pdfKey: `${estimate.tenantId}/estimates/${estimate.id}.pdf` },
    });
    return { pdfUrl };
  }

  async sendViaWhatsApp(id: number, tenantId: string, role?: string) {
    const estimate = await this.prisma.estimate.findFirst({
      where: { id, tenantId },
      include: { client: true, items: true, tenant: true },
    });
    if (!estimate) throw new NotFoundException('Orçamento não encontrado');
    if (!estimate.client.phone) {
      throw new BadRequestException('Cliente sem telefone');
    }

    let pdfUrl = estimate.pdfUrl;
    if (!pdfUrl) {
      this.logger.warn(`PDF não encontrado para orçamento ${id}, gerando sob demanda`);
      const pdfBuffer = await this.estimatesPdfService.generateEstimatePdf(estimate, estimate.tenant);
      pdfUrl = await this.storageService.uploadPdf(pdfBuffer, `${tenantId}/estimates/${estimate.id}.pdf`);
      await this.prisma.estimate.update({
        where: { id },
        data: { pdfUrl, pdfKey: `${tenantId}/estimates/${estimate.id}.pdf` },
      });
      const updated = await this.prisma.estimate.findFirst({
        where: { id, tenantId },
        include: { client: true, tenant: true },
      });
      estimate.client = updated!.client;
    }

    const message = `Olá ${estimate.client.name}!\n\n✅ Seu orçamento #${estimate.id} está pronto!\n\n📄 PDF: ${pdfUrl}\n\n💰 Total: R$ ${estimate.total.toFixed(2)}`;
    const whatsappLink = this.whatsappService.generateWhatsAppLink(estimate.client.phone, message);
    return { whatsappLink, pdfUrl, publicLink: pdfUrl };
  }
}