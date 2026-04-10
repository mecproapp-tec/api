import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

// 🔥 CORE
import { PrismaModule } from './shared/prisma/prisma.module';


// 🔥 FILA (DESATIVADA POR AGORA)
// import { QueueModule } from './modules/common/queues/queue.module';

// 🔥 FEATURE MODULES
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
import { StorageModule } from './modules/storage/storage.module';
import { UsersModule } from './modules/users/users.module';

import { PublicShareModule } from './modules/public-share/public-share.module';

// 🔥 APP
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),

    // ⚡ CORE
    PrismaModule,
   

    // ⚠️ FILA DESATIVADA (EVITA SOBRESCREVER PDF)
    // QueueModule,

    // ⚡ AUTH / CORE APP
    AuthModule,
    PaymentModule,
    WebhookModule,

    // ⚡ FEATURES
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
    StorageModule,
    UsersModule,

    PublicShareModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}