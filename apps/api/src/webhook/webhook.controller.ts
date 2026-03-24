import { Controller, Post, Body, Headers, BadRequestException } from '@nestjs/common';
import { PaymentService } from '../payments/payment.service';
import { PrismaService } from '../shared/prisma/prisma.service';
import * as crypto from 'crypto';

@Controller('webhook')
export class WebhookController {
  constructor(
    private paymentService: PaymentService,
    private prisma: PrismaService,
  ) {}

  @Post('mercadopago')
  async mercadopagoWebhook(
    @Body() body: any,
    @Headers('x-signature') signature: string,
  ) {
    const secret = process.env.MP_WEBHOOK_SECRET;
    if (secret && signature) {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(body))
        .digest('hex');
      if (signature !== expectedSignature) {
        console.warn('Assinatura inválida, ignorando webhook');
        throw new BadRequestException('Assinatura inválida');
      }
    }

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
              status: 'paid',
            },
          });
          console.log(`✅ Pendência ${externalRef} confirmada e marcada como paga.`);
        } else {
          await this.prisma.pendingSubscription.upsert({
            where: { email: subscription.payer_email },
            update: {
              subscriptionId: subscription.id,
              status: 'paid',
            },
            create: {
              email: subscription.payer_email,
              subscriptionId: subscription.id,
              planId: subscription.preapproval_plan_id,
              trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              status: 'paid',
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