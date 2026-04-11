import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SessionGuard } from '../../auth/guards/session.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

interface UserPayload {
  id: number;
  tenantId: string;
  role: string;
  sessionToken: string;
}

@Controller('notifications')
@UseGuards(JwtAuthGuard, SessionGuard)
export class NotificationsController {
  @Get()
  async findAll(@CurrentUser() user: UserPayload) {
    return { message: 'Lista de notificações', userId: user.id };
  }

  @Post()
  async create(@Body() data: any, @CurrentUser() user: UserPayload) {
    return { message: 'Notificação criada', data, userId: user.id };
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    return { message: `Notificação ${id}`, userId: user.id };
  }

  @Post(':id/mark-read')
  async markAsRead(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    return { message: `Notificação ${id} marcada como lida` };
  }
}