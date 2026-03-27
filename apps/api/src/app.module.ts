import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';

import { PrismaModule } from './shared/prisma/prisma.module';
import { SharedModule } from './shared/shared.module';
import { AuthModule } from './auth/auth.module';
import { PaymentModule } from './payments/payment.module';
import { WebhookModule } from './webhook/webhook.module';

import { ClientsModule } from './modules/clients/clients.module';
import { EstimatesModule } from './modules/estimates/estimates.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { AdminModule } from './modules/admin/admin.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { ContactModule } from './modules/contact/contact.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { QueueModule } from './modules/common/queues/queue.module';
import { PdfModule } from './modules/pdf/pdf.module';
import { StorageModule } from './modules/storage/storage.module';
import { PdfProcessor } from './modules/common/queues/pdf-processor.service';

import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    // Configuração única do BullMQ – delegada ao QueueModule
    QueueModule,
    BullModule.registerQueue({ name: 'pdf' }),
    PrismaModule,
    SharedModule,
    AuthModule,
    PaymentModule,
    WebhookModule,
    ClientsModule,
    EstimatesModule,
    InvoicesModule,
    SubscriptionsModule,
    TenantsModule,
    AdminModule,
    NotificationsModule,
    AppointmentsModule,
    ContactModule,
    WhatsappModule,
    PdfModule,
    StorageModule,
  ],
  controllers: [AppController],
  providers: [AppService, PdfProcessor],
})
export class AppModule {}