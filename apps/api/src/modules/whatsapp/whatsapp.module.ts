import { Module, forwardRef } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';
import { SendEstimateWhatsappService } from './send-estimate-whatsapp.service';

import { EstimatesModule } from '../estimates/estimates.module';
import { StorageModule } from '../storage/storage.module';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Module({
  imports: [
    forwardRef(() => EstimatesModule), // 🔥 AQUI
    StorageModule,
  ],
  providers: [
    WhatsappService,
    SendEstimateWhatsappService,
    PrismaService,
  ],
  controllers: [WhatsappController],
  exports: [WhatsappService, SendEstimateWhatsappService],
})
export class WhatsappModule {}