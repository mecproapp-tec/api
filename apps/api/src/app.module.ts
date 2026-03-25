import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";

import { PrismaModule } from "./shared/prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { PaymentModule } from "./payments/payment.module";
import { WebhookModule } from "./webhook/webhook.module";

import { ClientsModule } from "./modules/clients/clients.module";
import { EstimatesModule } from "./modules/estimates/estimates.module";
import { InvoicesModule } from "./modules/invoices/invoices.module";
import { SubscriptionsModule } from "./modules/subscriptions/subscriptions.module";
import { TenantsModule } from "./modules/tenants/tenants.module";
import { AdminModule } from "./modules/admin/admin.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { AppointmentsModule } from "./modules/appointments/appointments.module";
import { ContactModule } from "./modules/contact/contact.module";
import { WhatsappModule } from "./modules/whatsapp/whatsapp.module";

// ❌ Remova esta linha se existir
// import { PublicModule } from "./modules/public/public.module";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
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
    // ❌ Não inclua PublicModule aqui
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}