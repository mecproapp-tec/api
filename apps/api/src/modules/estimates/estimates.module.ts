import { Module } from '@nestjs/common';
import { EstimatesService } from './estimates.service';
import { EstimatesController, PublicEstimatesController } from './estimates.controller';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { EstimatesPdfService } from './estimates-pdf.service';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [PrismaModule, WhatsappModule],
  controllers: [EstimatesController, PublicEstimatesController], // ✅ ambos registrados
  providers: [EstimatesService, EstimatesPdfService],
})
export class EstimatesModule {}