import { Module } from '@nestjs/common';
import { EstimatesService } from './estimates.service';
import { EstimatesController, PublicEstimatesController } from './estimates.controller';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { EstimatesPdfService } from './estimates-pdf.service';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { StorageModule } from '../storage/storage.module';
import { BrowserPoolService } from '../../shared/browser-pool.service';

@Module({
  imports: [PrismaModule, WhatsappModule, StorageModule],
  controllers: [EstimatesController, PublicEstimatesController],
  providers: [EstimatesService, EstimatesPdfService, BrowserPoolService],
  exports: [EstimatesPdfService],
})
export class EstimatesModule {}