import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { InvoicesService } from './invoices.service';
import { InvoicesController, PublicInvoicesController } from './invoices.controller';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { StorageModule } from '../storage/storage.module';
import { InvoicesPdfService } from './invoices-pdf.service';
import { ConfigModule } from '@nestjs/config';
import { BrowserPoolService } from '../../shared/browser-pool.service'; // <-- importado

@Module({
  imports: [
    PrismaModule,
    WhatsappModule,
    StorageModule,
    ConfigModule,
    BullModule.registerQueue({ name: 'pdf' }),
  ],
  controllers: [InvoicesController, PublicInvoicesController],
  providers: [
    InvoicesService,
    InvoicesPdfService,
    BrowserPoolService, // <-- adicionado
  ],
  exports: [InvoicesPdfService],
})
export class InvoicesModule {}