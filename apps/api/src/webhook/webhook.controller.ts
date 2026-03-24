import { Controller, Post, Body } from '@nestjs/common';
import { PaymentService } from '../payments/payment.service';
import { PrismaService } from '../shared/prisma/prisma.service';

@Controller('webhook')
export class WebhookController {
  constructor(
    private paymentService: PaymentService,
    private prisma: PrismaService,
  ) {}

  @Post('mercadopago')
  async mercadopagoWebhook(@Body() body: any) {
    console.log('Webhook recebido:', JSON.stringify(body, null, 2));

    const { type, data } = body;

    if (type === 'preapproval') {
      const subscription = await this.paymentService.getSubscription(data.id);
      if (subscription.status === 'authorized') {
        const externalRef = subscription.external_reference;
        if (externalRef) {
          await this.prisma.pendingSubscription.update({
            where: { id: externalRef },
            data: {
              subscriptionId: subscription.id,
              planId: subscription.preapproval_plan_id,
            },
          });
          console.log(`✅ Pendência ${externalRef} confirmada.`);
        } else {
          await this.prisma.pendingSubscription.upsert({
            where: { email: subscription.payer_email },
            update: { subscriptionId: subscription.id },
            create: {
              email: subscription.payer_email,
              subscriptionId: subscription.id,
              planId: subscription.preapproval_plan_id,
              trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          });
        }
      }
    }

    if (type === 'payment') {
      const payment = await this.paymentService.getPayment(data.id);
      if (payment.status === 'approved' && payment.payer?.email) {
        console.log(`✅ Pagamento aprovado para ${payment.payer.email}`);
      }
    }

    return { received: true };
  }
}