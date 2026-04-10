import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { TenantStatus } from '@prisma/client';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private prisma: PrismaService) {}

  // ================= DASHBOARD =================

  async getDashboard() {
    const [
      totalTenants,
      activeTenants,
      blockedTenants,
      totalClients,
      totalEstimates,
      totalInvoices,
    ] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { status: 'ACTIVE' } }),
      this.prisma.tenant.count({ where: { status: 'BLOCKED' } }),
      this.prisma.client.count(),
      this.prisma.estimate.count(),
      this.prisma.invoice.count(),
    ]);

    return {
      totalTenants,
      activeTenants,
      blockedTenants,
      totalClients,
      totalEstimates,
      totalInvoices,
    };
  }

  // ================= TENANTS =================

  async getTenants(query: any) {
    const where: any = {};

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.status) {
      where.status = query.status;
    }

    return this.prisma.tenant.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTenant(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) throw new NotFoundException('Tenant não encontrado');

    return tenant;
  }

  async updateTenantStatus(id: string, status: TenantStatus) {
    return this.prisma.tenant.update({
      where: { id },
      data: { status },
    });
  }

  async deleteTenant(id: string) {
    return this.prisma.tenant.delete({ where: { id } });
  }

  // ================= FINANCEIRO =================

  async getFinancialSummary(query: any) {
    const year = query.year
      ? parseInt(query.year)
      : new Date().getFullYear();

    const invoices = await this.prisma.invoice.findMany({
      where: {
        createdAt: {
          gte: new Date(year, 0, 1),
          lte: new Date(year, 11, 31),
        },
        status: 'PAID',
      },
    });

    const totalRevenue = invoices.reduce(
      (acc, inv) => acc + inv.total,
      0,
    );

    return {
      totalRevenue,
      totalInvoices: invoices.length,
    };
  }

  // ================= NOTIFICATIONS (FIX DO ERRO) =================

  async sendNotification(body: any) {
    const { message, title, target, tenantIds } = body;

    let tenants: any[] = [];

    if (target === 'all') {
      tenants = await this.prisma.tenant.findMany({
        select: { id: true },
      });
    } else if (target === 'specific') {
      tenants = tenantIds.map((id) => ({ id }));
    } else {
      throw new BadRequestException('Target inválido');
    }

    const data = tenants.map((t) => ({
      tenantId: t.id,
      title,
      message,
      read: false,
      isGlobal: target === 'all',
    }));

    await this.prisma.notification.createMany({ data });

    return { success: true };
  }

  async scheduleNotification(body: any) {
    this.logger.log('Notificação agendada (mock)');
    return { success: true };
  }

  // ================= INVOICES =================

  async getAllInvoices(query: any) {
    const where: any = {};

    if (query.tenantId) where.tenantId = query.tenantId;
    if (query.status) where.status = query.status;

    return this.prisma.invoice.findMany({
      where,
      include: { client: true, tenant: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getInvoiceById(id: number) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        client: true,
        tenant: true,
        items: true,
      },
    });

    if (!invoice) throw new NotFoundException('Fatura não encontrada');

    return invoice;
  }

  // ================= ESTIMATES =================

  async getAllEstimates(query: any) {
    const where: any = {};

    if (query.tenantId) where.tenantId = query.tenantId;
    if (query.status) where.status = query.status;

    return this.prisma.estimate.findMany({
      where,
      include: { client: true, tenant: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getEstimateById(id: number) {
    const estimate = await this.prisma.estimate.findUnique({
      where: { id },
      include: {
        client: true,
        tenant: true,
        items: true,
      },
    });

    if (!estimate)
      throw new NotFoundException('Orçamento não encontrado');

    return estimate;
  }

  // ================= CLIENTS =================

  async getAllClients(query: any) {
    const where: any = {};

    if (query.search) {
      where.name = {
        contains: query.search,
        mode: 'insensitive',
      };
    }

    if (query.tenantId) {
      where.tenantId = query.tenantId;
    }

    return this.prisma.client.findMany({
      where,
      include: { tenant: true },
    });
  }

  async getClientById(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id: Number(id) },
    });

    if (!client)
      throw new NotFoundException('Cliente não encontrado');

    return client;
  }

  // ================= NOTIFICATIONS =================

  async getNotifications() {
    return this.prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async markAsRead(id: string) {
    return this.prisma.notification.update({
      where: { id: Number(id) },
      data: { read: true },
    });
  }

  async markAllAsRead() {
    return this.prisma.notification.updateMany({
      where: { read: false },
      data: { read: true },
    });
  }

  async deleteNotification(id: number) {
    return this.prisma.notification.delete({
      where: { id },
    });
  }
}