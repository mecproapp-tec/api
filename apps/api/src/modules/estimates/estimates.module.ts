import { Module, forwardRef } from '@nestjs/common';
import { EstimatesController } from './estimates.controller';
import { EstimatesService } from './estimates.service';
import { EstimatesPdfService } from './estimates-pdf.service';

import { StorageModule } from '../storage/storage.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Module({
  imports: [
    StorageModule,
    forwardRef(() => WhatsappModule), // 🔥 AQUI
  ],
  controllers: [EstimatesController],
  providers: [EstimatesService, EstimatesPdfService, PrismaService],
  exports: [EstimatesService, EstimatesPdfService],
})
export class EstimatesModule {}