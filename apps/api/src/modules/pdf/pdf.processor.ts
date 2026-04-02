import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable } from '@nestjs/common';

import { EstimatesPdfService } from '../estimates/estimates-pdf.service';
import { InvoicesPdfService } from '../invoices/invoices-pdf.service';
import { StorageService } from '../storage/storage.service';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Processor('pdf')
@Injectable()
export class PdfProcessor extends WorkerHost {
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

    let pdfBuffer: Buffer;

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) throw new Error('Tenant not found');

    if (entityType === 'estimate') {
      pdfBuffer = await this.estimatesPdfService.generateEstimatePdf(data, tenant);
    } else if (entityType === 'invoice') {
      pdfBuffer = await this.invoicesPdfService.generateInvoicePdf(data, tenant);
    } else {
      throw new Error('Invalid entity type');
    }

    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('Invalid PDF');
    }

    const key = `${tenantId}/${entityType}s/${entityId}.pdf`;
    const pdfUrl = await this.storageService.upload(pdfBuffer, key);

    if (entityType === 'estimate') {
      await this.prisma.estimate.update({
        where: { id: entityId },
        data: {
          pdfUrl,
          pdfStatus: 'generated',
          pdfGeneratedAt: new Date(),
        },
      });
    } else {
      await this.prisma.invoice.update({
        where: { id: entityId },
        data: {
          pdfUrl,
          pdfStatus: 'generated',
          pdfGeneratedAt: new Date(),
        },
      });
    }

    return { pdfUrl };
  }
}