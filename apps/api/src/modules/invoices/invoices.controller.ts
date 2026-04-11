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

@Controller('invoices')
@UseGuards(JwtAuthGuard, SessionGuard, BillingGuard)
export class InvoicesController {
  @Get()
  async findAll(@CurrentUser() user: UserPayload) {
    return { message: 'Lista de faturas', tenantId: user.tenantId };
  }

  @Post()
  async create(@Body() data: any, @CurrentUser() user: UserPayload) {
    return { message: 'Fatura criada', data, tenantId: user.tenantId };
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    return { message: `Fatura ${id}`, tenantId: user.tenantId };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() data: any, @CurrentUser() user: UserPayload) {
    return { message: `Fatura ${id} atualizada`, data };
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    return { message: `Fatura ${id} removida` };
  }

  @Post(':id/send-whatsapp')
  async sendToWhatsApp(
    @Param('id') id: string,
    @Body() body: { phoneNumber: string },
    @CurrentUser() user: UserPayload,
  ) {
    return { 
      message: `Link para enviar fatura ${id} via WhatsApp`,
      whatsappUrl: `https://wa.me/55${body.phoneNumber}?text=Fatura%20${id}`,
      tenantId: user.tenantId,
    };
  }
}