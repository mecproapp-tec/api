import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
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
export class EstimatesService {
  private readonly logger = new Logger(EstimatesService.name);

  constructor(
    private prisma: PrismaService,
    private estimatesPdfService: EstimatesPdfService,
    private whatsappService: WhatsappService,
    private configService: ConfigService,
    private storageService: StorageService,
    @InjectQueue('pdf') private pdfQueue: Queue,
  ) {}

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

  async findAll(tenantId: string, userRole?: string) {
    const where: any = {};
    if (userRole !== 'SUPER_ADMIN' && userRole !== 'ADMIN') {
      where.tenantId = tenantId;
    }
    return this.prisma.estimate.findMany({
      where,
      select: {
        id: true,
        clientId: true,
        date: true,
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
    const estimate = await this.prisma.estimate.findFirst({
      where,
      select: {
        id: true,
        clientId: true,
        date: true,
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
    if (!estimate) throw new NotFoundException('Orçamento não encontrado');
    return estimate;
  }

  async update(
    id: number,
    tenantId: string,
    data: { clientId: number; date: string; items: any[]; status?: string },
    userRole?: string,
  ) {
    await this.findOne(id, tenantId, userRole);
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

  async remove(id: number, tenantId: string, userRole?: string) {
    await this.findOne(id, tenantId, userRole);
    await this.prisma.estimateItem.deleteMany({ where: { estimateId: id } });
    await this.prisma.estimate.delete({ where: { id } });
    return { message: 'Orçamento removido com sucesso' };
  }

  async generateShareToken(id: number, tenantId: string, userRole?: string): Promise<string> {
    const estimate = await this.findOne(id, tenantId, userRole);
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
      select: {
        id: true,
        tenantId: true,
        date: true,
        total: true,
        status: true,
        shareTokenExpires: true,
        pdfUrl: true,
        pdfStatus: true,
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
    if (!estimate) {
      throw new UnauthorizedException('Token inválido');
    }
    if (estimate.shareTokenExpires && new Date() > estimate.shareTokenExpires) {
      throw new UnauthorizedException('Token expirado');
    }
    return estimate;
  }

  async getPdfByShareToken(token: string): Promise<{ pdfUrl?: string; pdfBuffer: Buffer }> {
    const estimate = await this.validateShareToken(token);

    if (estimate.pdfUrl) {
      try {
        const pdfBuffer = await this.storageService.get(estimate.pdfUrl);
        return { pdfUrl: estimate.pdfUrl, pdfBuffer };
      } catch (err) {
        this.logger.warn(`Erro ao buscar PDF do R2: ${err.message}. Gerando novo.`);
      }
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: estimate.tenantId },
      select: {
        name: true,
        documentNumber: true,
        phone: true,
        email: true,
        logoUrl: true,
      },
    });

    const pdfBuffer = await this.estimatesPdfService.generateEstimatePdf(estimate, tenant);
    const key = `${estimate.tenantId}/estimates/${estimate.id}.pdf`;
    const pdfUrl = await this.storageService.upload(pdfBuffer, key);

    await this.prisma.estimate.update({
      where: { id: estimate.id },
      data: {
        pdfUrl,
        pdfStatus: 'generated',
        pdfGeneratedAt: new Date(),
      },
    });

    return { pdfUrl, pdfBuffer };
  }

  async sendViaWhatsApp(
    id: number,
    tenantId: string,
    workshopData?: any,
    userRole?: string,
  ): Promise<{ whatsappLink: string; pdfUrl: string }> {
    const where: any = { id };
    if (userRole !== 'SUPER_ADMIN' && userRole !== 'ADMIN') {
      where.tenantId = tenantId;
    }
    const estimate = await this.prisma.estimate.findFirst({
      where,
      include: { client: true, items: true, tenant: true },
    });
    if (!estimate) throw new NotFoundException('Orçamento não encontrado');
    const client = estimate.client;

    if (!client.phone) {
      throw new BadRequestException('Cliente não possui telefone cadastrado');
    }

    let token = estimate.shareToken;
    if (!token || (estimate.shareTokenExpires && new Date() > estimate.shareTokenExpires)) {
      token = await this.generateShareToken(estimate.id, tenantId, userRole);
    }

    const apiBase = (process.env.API_URL || process.env.APP_URL || 'https://api.mecpro.tec.br').replace(/\/api$/, '');
    const pdfUrl = `${apiBase}/api/public/estimates/share/${token}`;

    if (!estimate.pdfUrl || estimate.pdfStatus !== 'generated') {
      const tenant = estimate.tenant;
      const effectiveTenant = workshopData
        ? {
            ...tenant,
            name: workshopData.name ?? tenant.name,
            documentNumber: workshopData.documentNumber ?? tenant.documentNumber,
            phone: workshopData.phone ?? tenant.phone,
            email: workshopData.email ?? tenant.email,
            logoUrl: workshopData.logoUrl ?? tenant.logoUrl,
          }
        : tenant;

      const estimateData = {
        logoUrl: effectiveTenant.logoUrl,
        estimateNumber: estimate.id,
        client: {
          name: client.name,
          document: client.document || 'Não informado',
          address: client.address || 'Não informado',
          phone: client.phone,
          vehicle: client.vehicle,
          plate: client.plate,
        },
        issueDate: new Date(estimate.date).toLocaleDateString('pt-BR'),
        validUntil: new Date(new Date(estimate.date).getTime() + 10 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
        status: estimate.status === 'DRAFT' ? 'Pendente' : estimate.status === 'APPROVED' ? 'Aceito' : 'Convertido',
        items: estimate.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.price.toFixed(2),
          issPercent: item.issPercent || 0,
          total: item.total.toFixed(2),
        })),
        subtotal: estimate.items.reduce((acc, item) => acc + item.price * item.quantity, 0).toFixed(2),
        issValue: estimate.items
          .reduce((acc, item) => {
            const iss = item.issPercent ? item.price * (item.issPercent / 100) * item.quantity : 0;
            return acc + iss;
          }, 0)
          .toFixed(2),
        total: estimate.total.toFixed(2),
        companyName: effectiveTenant.name || 'Oficina Mecânica',
        companyDocument: effectiveTenant.documentNumber || '00.000.000/0001-00',
        companyPhone: effectiveTenant.phone || '(11) 1234-5678',
        companyEmail: effectiveTenant.email || 'contato@oficina.com',
      };

      await this.pdfQueue.add('generate', {
        tenantId,
        entityId: id,
        entityType: 'estimate',
        data: estimateData,
      });

      await this.prisma.estimate.update({
        where: { id, tenantId },
        data: { pdfStatus: 'pending' },
      });
    }

    const message = this.buildWhatsAppMessage(estimate, pdfUrl);
    const whatsappLink = this.whatsappService.generateWhatsAppLink(client.phone, message);

    return { whatsappLink, pdfUrl };
  }

  private buildWhatsAppMessage(estimate: any, pdfUrl: string): string {
    const client = estimate.client;
    const documentText = client.document ? `📄 Documento: ${client.document}` : '';
    const addressText = client.address ? `📍 Endereço: ${client.address}` : '';

    let message = `Olá ${client.name}!`;

    if (documentText) message += `\n${documentText}`;
    if (addressText) message += `\n${addressText}`;

    message += `\n\nSeu orçamento está pronto ✅\n\n${pdfUrl}\n\n🚗 Veículo: ${client.vehicle || 'Não informado'}\n💰 Total: R$ ${estimate.total.toFixed(2)}\n📌 Status: ${estimate.status === 'DRAFT' ? 'Pendente' : estimate.status === 'APPROVED' ? 'Aceito' : 'Convertido'}`;

    return message;
  }
}