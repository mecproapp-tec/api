import { Module } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';
import { StorageModule } from '../storage/storage.module';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Module({
  imports: [StorageModule],
  providers: [WhatsappService, PrismaService],
  controllers: [WhatsappController],
  exports: [WhatsappService],
})
export class WhatsappModule {}