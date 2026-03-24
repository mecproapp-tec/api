import { Body, Controller, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PaymentService } from './payment.service';

@Controller('payments')
export class PaymentsController {
  constructor(
    private paymentService: PaymentService,
    private configService: ConfigService,
  ) {}

  @Post('subscription')
  async createSubscription(@Body() body: { email: string; planId: string }) {
    return this.paymentService.createSubscription(body.email, body.planId);
  }

  @Post('create-plan')
  async createPlan() {
    const accessToken = this.configService.get('MP_ACCESS_TOKEN');

    const planData = {
      reason: "Assinatura MecPro - 30 dias grátis",
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: 1.00,
        currency_id: "BRL",
        free_trial: {
          frequency: 30,
          frequency_type: "days"
        }
      },
      payment_methods_allowed: {
        payment_types: [
          { id: "credit_card" },
          { id: "debit_card" }
        ]
      },
      back_url: "https://www.mecpro.tec.br/cadastro?payment=success"
    };

    try {
      const response = await axios.post(
        'https://api.mercadopago.com/preapproval_plan',
        planData,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      console.log('✅ Plano criado:', response.data.id);
      return { planId: response.data.id, init_point: response.data.init_point };
    } catch (error) {
      console.error('Erro ao criar plano:', error.response?.data || error);
      throw error;
    }
  }

  @Post('create-pending')
  async createPending(@Body() body: { email: string }) {
    const pending = await this.paymentService.createPendingSubscription(body.email);
    return { checkoutUrl: pending.checkoutUrl, pendingId: pending.id };
  }
}