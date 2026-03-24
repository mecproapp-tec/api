import { Controller, Get, Put, Body, UseGuards, Request } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';

@Controller('tenants')
@UseGuards(JwtAuthGuard)
export class TenantsController {
  constructor(private tenantsService: TenantsService) {}

  @Get('me')
  async getMyTenant(@Request() req) {
    return this.tenantsService.getById(req.user.tenantId);
  }

  @Put('me')
  async updateMyTenant(@Request() req, @Body() updateData: any) {
    return this.tenantsService.update(req.user.tenantId, updateData);
  }
}