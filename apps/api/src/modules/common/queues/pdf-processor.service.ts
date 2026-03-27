import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';

import { EstimatesPdfService } from '../../estimates/estimates-pdf.service';
import { InvoicesPdfService } from '../../invoices/invoices-pdf.service';
import { StorageService } from '../../storage/storage.service';
import { PrismaService } from '../../../shared/prisma/prisma.service';

@Processor('pdf')
@Injectable()
export class PdfProcessor extends WorkerHost {
  private readonly logger = new Logger(PdfProcessor.name);

  constructor(
    private readonly estimatesPdfService: EstimatesPdfService,
    private readonly invoicesPdfService: InvoicesPdfService,
    private readonly storageService: StorageService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    const { tenantId, entityId, entityType, data } = job.data;
    this.logger.log(`Processando ${entityType} ${entityId}`);

    try {
      let pdfBuffer: Buffer;
      if (entityType === 'estimate') {
        pdfBuffer = await this.estimatesPdfService.generateEstimatePdf(data, data);
      } else if (entityType === 'invoice') {
        pdfBuffer = await this.invoicesPdfService.generateInvoicePdf(data, data);
      } else {
        throw new Error(`Tipo desconhecido: ${entityType}`);
      }

      const key = `${tenantId}/${entityType}s/${entityId}.pdf`;
      const pdfUrl = await this.storageService.upload(pdfBuffer, key);

      if (entityType === 'estimate') {
        await this.prisma.estimate.update({
          where: { id: entityId },
          data: { pdfUrl, pdfStatus: 'generated', pdfGeneratedAt: new Date() },
        });
      } else {
        await this.prisma.invoice.update({
          where: { id: entityId },
          data: { pdfUrl, pdfStatus: 'generated', pdfGeneratedAt: new Date() },
        });
      }

      this.logger.log(`PDF gerado e salvo: ${pdfUrl}`);
      return { pdfUrl };
    } catch (error) {
      this.logger.error(`Erro ao processar job ${job.id}:`, error);
      throw error;
    }
  }
}