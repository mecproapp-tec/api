import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  async getById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        users: true,
        subscriptions: true,
      },
    });
    if (!tenant) {
      throw new NotFoundException('Oficina não encontrada');
    }
    return tenant;
  }

  async update(id: string, data: any) {
    return this.prisma.tenant.update({
      where: { id },
      data,
    });
  }

  async findBySubscriptionId(subscriptionId: string) {
    return this.prisma.tenant.findFirst({
      where: { subscriptionId },
    });
  }
}