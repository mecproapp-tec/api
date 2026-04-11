import { Module } from '@nestjs/common';
import { EstimatesController } from './estimates.controller';
import { EstimatesService } from './estimates.service';
import { EstimatesPdfService } from './estimates-pdf.service';
import { EstimatesWhatsappService } from './estimates-whatsapp.service';
import { StorageService } from '../storage/storage.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { AuthModule } from '../../auth/auth.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [AuthModule, WhatsappModule],
  controllers: [EstimatesController],
  providers: [
    PrismaService,
    EstimatesService,
    EstimatesPdfService,
    StorageService,
    EstimatesWhatsappService,
  ],
  exports: [EstimatesService, EstimatesPdfService, EstimatesWhatsappService],
})
export class EstimatesModule {}