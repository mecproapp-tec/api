import { Module } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { InvoicesController, PublicInvoicesController } from './invoices.controller';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { StorageModule } from '../storage/storage.module';
import { InvoicesPdfService } from './invoices-pdf.service';
import { BrowserPoolService } from '../../shared/browser-pool.service';

@Module({
  imports: [PrismaModule, WhatsappModule, StorageModule],
  controllers: [InvoicesController, PublicInvoicesController],
  providers: [InvoicesService, InvoicesPdfService, BrowserPoolService],
  exports: [InvoicesPdfService],
})
export class InvoicesModule {}