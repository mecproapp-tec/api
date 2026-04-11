import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SessionGuard } from '../../auth/guards/session.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

interface UserPayload {
  id: number;
  tenantId: string;
  role: string;
  sessionToken: string;
}

@Controller('subscriptions')
@UseGuards(JwtAuthGuard, SessionGuard)
export class SubscriptionsController {
  @Get()
  async findMySubscription(@CurrentUser() user: UserPayload) {
    return { 
      message: 'Minha assinatura',
      tenantId: user.tenantId,
      plan: 'PRO',
      status: 'ACTIVE',
    };
  }

  @Post('cancel')
  async cancelSubscription(@CurrentUser() user: UserPayload) {
    return { message: 'Assinatura cancelada', tenantId: user.tenantId };
  }

  @Get('admin/all')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  async findAllSubscriptions() {
    return { message: 'Lista de todas as assinaturas' };
  }
}