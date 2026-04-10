import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { EstimatesPdfService } from '../estimates/estimates-pdf.service';
import { StorageService } from '../storage/storage.service';
import { WhatsappService } from './whatsapp.service';
import { buildEstimateMessage } from '../estimates/estimate-message.util';

@Injectable()
export class SendEstimateWhatsappService {
  private readonly logger = new Logger(SendEstimateWhatsappService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfService: EstimatesPdfService,
    private readonly storageService: StorageService,
    private readonly whatsappService: WhatsappService,
  ) {}

  // 🔥 CENTRALIZA PDF (EVITA DUPLICAÇÃO)
  private async ensurePdf(estimate: any) {
    if (estimate.pdfUrl) return estimate;

    const pdfBuffer = await this.pdfService.generateEstimatePdf(estimate);

    const pdfKey = `${estimate.tenantId}/estimates/${estimate.id}.pdf`;

    const pdfUrl = await this.storageService.uploadPdf(pdfBuffer, pdfKey);

    const updated = await this.prisma.estimate.update({
      where: { id: estimate.id },
      data: {
        pdfUrl,
        pdfKey,
        pdfStatus: 'generated',
        pdfGeneratedAt: new Date(),
      },
    });

    return { ...estimate, ...updated };
  }

  async execute(estimateId: number) {
    const estimate = await this.prisma.estimate.findUnique({
      where: { id: estimateId },
      include: { client: true, items: true, tenant: true },
    });

    if (!estimate) {
      throw new NotFoundException('Orçamento não encontrado');
    }

    if (!estimate.client?.phone) {
      throw new NotFoundException('Cliente sem telefone');
    }

    // 🔥 GARANTE PDF (SEM DUPLICAR)
    const updated = await this.ensurePdf(estimate);

    // 🔥 USA PADRÃO CENTRAL
    const msg = buildEstimateMessage(updated, updated.pdfUrl);

    const whatsappLink = this.whatsappService.generateWhatsAppLink(
      updated.client.phone,
      msg.text,
    );

    this.logger.log(`📲 WhatsApp gerado para orçamento ${estimate.id}`);

    return {
      success: true,
      whatsappLink,
      message: msg.text,
    };
  }
}