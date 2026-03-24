import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { PaymentModule } from '../payments/payment.module';
import { PrismaService } from '../shared/prisma/prisma.service';

@Module({
  imports: [PaymentModule],
  controllers: [WebhookController],
  providers: [PrismaService],
})
export class WebhookModule {}