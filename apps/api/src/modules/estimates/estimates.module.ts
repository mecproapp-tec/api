import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EstimatesService } from './estimates.service';
import { EstimatesController, PublicEstimatesController } from './estimates.controller';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { EstimatesPdfService } from './estimates-pdf.service';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    PrismaModule,
    WhatsappModule,
    StorageModule,
    BullModule.registerQueue({ name: 'pdf' }),
  ],
  controllers: [EstimatesController, PublicEstimatesController],
  providers: [EstimatesService, EstimatesPdfService],
  exports: [EstimatesPdfService], // <-- adicionado
})
export class EstimatesModule {}