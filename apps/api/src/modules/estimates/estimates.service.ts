import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';

import { PrismaService } from '../../shared/prisma/prisma.service';
import { EstimatesPdfService } from './estimates-pdf.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class EstimatesService {
  private readonly logger = new Logger(EstimatesService.name);

  constructor(
    private prisma: PrismaService,
    private estimatesPdfService: EstimatesPdfService,
    private storageService: StorageService,
  ) {}

  private calculate(items: any[]) {
    let total = 0;

    const normalized = items.map((item) => {
      const price = Number(item.price) || 0;
      const quantity = Number(item.quantity) || 1;
      const itemTotal = price * quantity;

      total += itemTotal;

      return {
        description: item.description,
        quantity,
        price,
        total: itemTotal,
      };
    });

    return { items: normalized, total };
  }

  async create(tenantId: string, data: any) {
    if (!data.items?.length) {
      throw new BadRequestException('Orçamento sem itens');
    }

    const { items, total } = this.calculate(data.items);

    const estimate = await this.prisma.estimate.create({
      data: {
        tenant: { connect: { id: tenantId } },
        client: { connect: { id: data.clientId } },
        total,
        status: 'DRAFT',
        date: new Date(),
        items: { create: items },
      },
      include: {
        items: true,
        client: true,
        tenant: true,
      },
    });

    try {
      const pdfBuffer =
        await this.estimatesPdfService.generateEstimatePdf(estimate);

      const pdfKey = `${tenantId}/estimates/${estimate.id}-${Date.now()}.pdf`;

      const pdfUrl = await this.storageService.uploadPdf(
        pdfBuffer,
        pdfKey,
      );

      await this.prisma.estimate.update({
        where: { id: estimate.id },
        data: {
          pdfUrl,
          pdfKey,
          pdfStatus: 'generated',
          pdfGeneratedAt: new Date(),
        },
      });

      this.logger.log(`PDF gerado para orçamento ${estimate.id}`);
    } catch (error) {
      this.logger.error(
        `Erro ao gerar PDF orçamento ${estimate.id}`,
        error,
      );
    }

    return estimate;
  }

  async findAll(tenantId: string) {
    return this.prisma.estimate.findMany({
      where: { tenantId },
      include: { client: true, items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number, tenantId: string) {
    const estimate = await this.prisma.estimate.findFirst({
      where: { id, tenantId },
      include: {
        client: true,
        items: true,
        tenant: true,
      },
    });

    if (!estimate) {
      throw new NotFoundException('Orçamento não encontrado');
    }

    return estimate;
  }

  async remove(id: number, tenantId: string) {
    await this.findOne(id, tenantId);

    return this.prisma.estimate.delete({
      where: { id },
    });
  }
}