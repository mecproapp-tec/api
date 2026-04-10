import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { InvoicesPdfService } from './invoices-pdf.service';
import { StorageModule } from '../storage/storage.module';
import { PublicShareModule } from '../public-share/public-share.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Module({
  imports: [StorageModule, PublicShareModule, WhatsappModule],
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoicesPdfService, PrismaService],
  exports: [InvoicesService, InvoicesPdfService], // 🔥 exporte o PdfService
})
export class InvoicesModule {}