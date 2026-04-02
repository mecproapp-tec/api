import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { randomBytes } from 'crypto';
import { EstimatesPdfService } from './estimates-pdf.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class EstimatesService {
  private readonly logger = new Logger(EstimatesService.name);

  constructor(
    private prisma: PrismaService,
    private estimatesPdfService: EstimatesPdfService,
    private whatsappService: WhatsappService,
    private storageService: StorageService,
  ) {}

  // -------------------------------------------------------------------------
  // Métodos CRUD
  // -------------------------------------------------------------------------
  async create(tenantId: string, data: any) {
    const { clientId, date, items } = data;
    if (!items || items.length === 0) {
      throw new BadRequestException('Orçamento deve ter pelo menos um item.');
    }
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId },
    });
    if (!client) throw new NotFoundException('Cliente não encontrado');

    const itemsWithTotal = items.map((item) => {
      const iss = item.issPercent ? item.price * (item.issPercent / 100) : 0;
      const total = (item.price + iss) * item.quantity;
      return { ...item, total };
    });
    const total = itemsWithTotal.reduce((acc, item) => acc + item.total, 0);

    return this.prisma.estimate.create({
      data: {
        tenantId,
        clientId,
        date: new Date(date),
        total,
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

  async update(id: number, tenantId: string, updateData: any, userRole?: string) {
    await this.findOne(id, tenantId, userRole);
    if (updateData.clientId) {
      const client = await this.prisma.client.findFirst({
        where: { id: updateData.clientId, tenantId },
      });
      if (!client) throw new NotFoundException('Cliente não encontrado');
    }
    if (updateData.items && updateData.items.length > 0) {
      await this.prisma.estimateItem.deleteMany({ where: { estimateId: id } });
      const itemsWithTotal = updateData.items.map((item) => {
        const iss = item.issPercent ? item.price * (item.issPercent / 100) : 0;
        const total = (item.price + iss) * item.quantity;
        return { ...item, total };
      });
      const total = itemsWithTotal.reduce((acc, item) => acc + item.total, 0);
      const dataToUpdate: any = {
        clientId: updateData.clientId,
        date: updateData.date ? new Date(updateData.date) : undefined,
        total,
        items: { create: itemsWithTotal },
      };
      if (updateData.status) dataToUpdate.status = updateData.status;
      return this.prisma.estimate.update({
        where: { id },
        data: dataToUpdate,
        include: { items: true, client: true },
      });
    }
    const dataToUpdate: any = {};
    if (updateData.clientId) dataToUpdate.clientId = updateData.clientId;
    if (updateData.date) dataToUpdate.date = new Date(updateData.date);
    if (updateData.status) dataToUpdate.status = updateData.status;
    return this.prisma.estimate.update({
      where: { id },
      data: dataToUpdate,
      include: { items: true, client: true },
    });
  }

  async remove(id: number, tenantId: string, userRole?: string) {
    await this.findOne(id, tenantId, userRole);
    await this.prisma.estimateItem.deleteMany({ where: { estimateId: id } });
    await this.prisma.estimate.delete({ where: { id } });
    return { message: 'Orçamento removido com sucesso' };
  }

  // -------------------------------------------------------------------------
  // Métodos para compartilhamento e PDF
  // -------------------------------------------------------------------------
  async generateShareToken(id: number, tenantId: string, userRole?: string): Promise<string> {
    this.logger.log(`generateShareToken chamado para orçamento ${id}, tenant ${tenantId}`);
    const where: any = { id };
    if (userRole !== 'SUPER_ADMIN' && userRole !== 'ADMIN') {
      where.tenantId = tenantId;
    }
    const estimate = await this.prisma.estimate.findFirst({ where });
    if (!estimate) throw new NotFoundException('Orçamento não encontrado');

    if (
      estimate.shareToken &&
      estimate.shareTokenExpires &&
      new Date() < estimate.shareTokenExpires
    ) {
      this.logger.log(`Token existente e válido: ${estimate.shareToken}`);
      return estimate.shareToken;
    }

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

    this.logger.log(`Novo token gerado: ${token}`);
    return token;
  }

  async validateShareToken(token: string) {
    const estimate = await this.prisma.estimate.findFirst({
      where: { shareToken: token },
      include: {
        client: true,
        items: true,
        tenant: true,
      },
    });
    if (!estimate) throw new UnauthorizedException('Token inválido');
    if (estimate.shareTokenExpires && new Date() > estimate.shareTokenExpires) {
      throw new UnauthorizedException('Token expirado');
    }
    return estimate;
  }

  async getPdfByShareToken(token: string): Promise<{ pdfUrl?: string; pdfBuffer: Buffer }> {
    this.logger.log(`getPdfByShareToken chamado para token: ${token}`);
    try {
      const estimate = await this.validateShareToken(token);

      if (estimate.pdfUrl) {
        try {
          const pdfBuffer = await this.storageService.get(estimate.pdfUrl);
          return { pdfUrl: estimate.pdfUrl, pdfBuffer };
        } catch (err) {
          this.logger.warn(`Erro ao recuperar PDF do R2: ${err.message}. Gerando novo.`);
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
      if (!tenant) throw new BadRequestException('Dados da oficina não encontrados');

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

      this.logger.log(`PDF gerado e salvo: ${pdfUrl}`);
      return { pdfUrl, pdfBuffer };
    } catch (error) {
      this.logger.error(`Erro em getPdfByShareToken:`, error.stack);
      if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Erro ao gerar PDF do orçamento');
    }
  }

  async sendViaWhatsApp(
    id: number,
    tenantId: string,
    workshopData?: any,
    userRole?: string,
  ): Promise<{ whatsappLink: string; pdfUrl: string }> {
    this.logger.log(`sendViaWhatsApp iniciado para estimate ${id}`);

    const where: any = { id };
    if (userRole !== 'SUPER_ADMIN' && userRole !== 'ADMIN') {
      where.tenantId = tenantId;
    }

    const estimate = await this.prisma.estimate.findFirst({
      where,
      include: {
        client: true,
        items: true,
        tenant: true,
      },
    });

    if (!estimate) throw new NotFoundException('Orçamento não encontrado');
    if (!estimate.client.phone) throw new BadRequestException('Cliente sem telefone');

    let token = estimate.shareToken;
    if (!token || (estimate.shareTokenExpires && new Date() > estimate.shareTokenExpires)) {
      token = await this.generateShareToken(id, tenantId, userRole);
    }

    const apiBase = (process.env.API_URL || process.env.APP_URL || '').replace(/\/api$/, '');
    const pdfPublicUrl = `${apiBase}/api/public/estimates/share/${token}`;

    if (!estimate.pdfUrl || estimate.pdfStatus !== 'generated') {
      this.logger.log('Gerando PDF agora...');
      const pdfBuffer = await this.estimatesPdfService.generateEstimatePdf(
        estimate,
        estimate.tenant,
      );
      const key = `${tenantId}/estimates/${id}.pdf`;
      const pdfUrl = await this.storageService.upload(pdfBuffer, key);
      await this.prisma.estimate.update({
        where: { id },
        data: {
          pdfUrl,
          pdfStatus: 'generated',
          pdfGeneratedAt: new Date(),
        },
      });
      this.logger.log(`✅ PDF gerado e salvo: ${pdfUrl}`);
    }

    const message = this.buildWhatsAppMessage(estimate, pdfPublicUrl);
    const whatsappLink = this.whatsappService.generateWhatsAppLink(
      estimate.client.phone,
      message,
    );

    return { whatsappLink, pdfUrl: pdfPublicUrl };
  }

  private buildWhatsAppMessage(estimate: any, pdfUrl: string): string {
    const client = estimate.client;
    const vehicle = client.vehicle || 'Não informado';
    return `Olá ${client.name}!

Seu orçamento está pronto ✅

${pdfUrl}

🚗 Veículo: ${vehicle}
💰 Total: R$ ${estimate.total.toFixed(2)}`;
  }
}