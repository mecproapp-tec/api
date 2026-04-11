import { Controller, Get, Post, Body, Param, Delete, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SessionGuard } from '../../auth/guards/session.guard';
import { BillingGuard } from '../../auth/guards/billing.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

interface UserPayload {
  id: number;
  tenantId: string;
  role: string;
  sessionToken: string;
}

@Controller('appointments')
@UseGuards(JwtAuthGuard, SessionGuard, BillingGuard)
export class AppointmentsController {
  @Get()
  async findAll(@CurrentUser() user: UserPayload) {
    return { message: 'Lista de agendamentos', tenantId: user.tenantId };
  }

  @Post()
  async create(@Body() data: any, @CurrentUser() user: UserPayload) {
    return { message: 'Agendamento criado', data, tenantId: user.tenantId };
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    return { message: `Agendamento ${id}`, tenantId: user.tenantId };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() data: any, @CurrentUser() user: UserPayload) {
    return { message: `Agendamento ${id} atualizado`, data };
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    return { message: `Agendamento ${id} removido` };
  }
}