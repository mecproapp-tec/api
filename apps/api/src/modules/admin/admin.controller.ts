import { Controller, Get, UseGuards } from '@nestjs/common';
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

@Controller('admin')
@UseGuards(JwtAuthGuard, SessionGuard, RolesGuard)
export class AdminController {
  @Get('dashboard')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async getDashboard(@CurrentUser() user: UserPayload) {
    return {
      message: 'Admin dashboard',
      user: {
        id: user.id,
        role: user.role,
        tenantId: user.tenantId,
      },
    };
  }
}