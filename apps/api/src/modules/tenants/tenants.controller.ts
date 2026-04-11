import { Controller, Get, Put, Body, Param, UseGuards } from '@nestjs/common';
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

@Controller('tenants')
@UseGuards(JwtAuthGuard, SessionGuard)
export class TenantsController {
  @Get('me')
  async getMyTenant(@CurrentUser() user: UserPayload) {
    return {
      message: 'Meu tenant',
      tenantId: user.tenantId,
      role: user.role,
    };
  }

  @Put('me')
  async updateMyTenant(@Body() data: any, @CurrentUser() user: UserPayload) {
    return {
      message: 'Tenant atualizado',
      tenantId: user.tenantId,
      data,
    };
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  async findAllTenants() {
    return { message: 'Lista de todos os tenants' };
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  async findOneTenant(@Param('id') id: string) {
    return { message: `Tenant ${id}` };
  }
}