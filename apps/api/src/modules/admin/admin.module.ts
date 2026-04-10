import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { InvoicesModule } from '../invoices/invoices.module';
import { EstimatesModule } from '../estimates/estimates.module';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Module({
  imports: [
    InvoicesModule,   // agora exporta InvoicesPdfService
    EstimatesModule,  // agora exporta EstimatesPdfService
  ],
  controllers: [AdminController],
  providers: [AdminService, PrismaService],
})
export class AdminModule {}