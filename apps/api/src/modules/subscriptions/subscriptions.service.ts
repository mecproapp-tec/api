import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class SubscriptionsService {
  constructor(private prisma: PrismaService) {}

  async getByTenantId(tenantId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { tenantId },
      include: { payments: true },
    });
    if (!subscription) {
      throw new NotFoundException('Assinatura não encontrada');
    }
    return subscription;
  }

  async getById(id: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id },
      include: { payments: true, tenant: true },
    });
    if (!subscription) {
      throw new NotFoundException('Assinatura não encontrada');
    }
    return subscription;
  }

  async createSubscription(data: {
    tenantId: string;
    planName: string;
    price: number;
    gateway: string;
    gatewaySubscriptionId: string;
    startDate: Date;
    endDate?: Date;
  }) {
    return this.prisma.subscription.create({
      data: {
        tenantId: data.tenantId,
        planName: data.planName,
        price: data.price,
        status: 'ACTIVE',
        gateway: data.gateway,
        gatewaySubscriptionId: data.gatewaySubscriptionId,
        startDate: data.startDate,
        endDate: data.endDate,
      },
    });
  }
}