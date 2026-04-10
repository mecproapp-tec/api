// src/modules/common/queues/queue.module.ts

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { PrismaModule } from 'src/shared/prisma/prisma.module';
import { StorageModule } from 'src/modules/storage/storage.module';
import { InvoicesModule } from 'src/modules/invoices/invoices.module';
import { EstimatesModule } from 'src/modules/estimates/estimates.module';



@Module({
  imports: [
    BullModule.forRoot({
      connection: { url: process.env.REDIS_URL! },
    }),
    BullModule.registerQueue({ name: 'pdf' }),

    PrismaModule,
    StorageModule,

    InvoicesModule,   // ✅ fornece InvoicesPdfService
    EstimatesModule,  // ✅ fornece EstimatesPdfService
  ],
 
})
export class QueueModule {}