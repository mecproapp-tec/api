import { Module } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { InvoicesController, PublicInvoicesController } from './invoices.controller';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [PrismaModule, WhatsappModule, ConfigModule],
  controllers: [InvoicesController, PublicInvoicesController], // ✅ ambos registrados
  providers: [InvoicesService],
})
export class InvoicesModule {}