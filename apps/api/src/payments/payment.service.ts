import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../shared/prisma/prisma.service';

@Injectable()
export class PaymentService {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  async createSubscription(email: string, planId: string) {
    const accessToken = this.configService.get('MP_ACCESS_TOKEN');

    const preapproval = {
      preapproval_plan_id: planId,
      payer_email: email,
      back_url: "https://www.mecpro.tec.br/cadastro?payment=success",
      status: "pending"
    };

    try {
      const response = await axios.post(
        'https://api.mercadopago.com/preapproval',
        preapproval,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      return { checkoutUrl: response.data.init_point };
    } catch (error) {
      console.error('Erro ao criar preapproval:', error.response?.data);
      throw new Error('Falha ao iniciar assinatura');
    }
  }

  async getSubscription(subscriptionId: string) {
    const accessToken = this.configService.get('MP_ACCESS_TOKEN');
    const response = await axios.get(
      `https://api.mercadopago.com/preapproval/${subscriptionId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    return response.data;
  }

  async getPayment(paymentId: string) {
    const accessToken = this.configService.get('MP_ACCESS_TOKEN');
    const response = await axios.get(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    return response.data;
  }

  async createPendingSubscription(email: string) {
    const planId = this.configService.get('MERCADOPAGO_PLAN_ID');
    if (!planId) {
      throw new Error('MERCADOPAGO_PLAN_ID não configurado');
    }

    const pending = await this.prisma.pendingSubscription.create({
      data: {
        email,
        planId,
        subscriptionId: crypto.randomUUID(),
        trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const checkoutUrl = `https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=${planId}&external_reference=${pending.id}`;

    return { ...pending, checkoutUrl };
  }
}