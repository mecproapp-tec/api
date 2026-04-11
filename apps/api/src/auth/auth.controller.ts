import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterAdminDto } from './dto/register-admin.dto';

import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';

interface UserPayload {
  id: number;
  tenantId: string;
  role: string;
  sessionToken: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('signup')
  async signup(
    @Body()
    body: {
      name: string;
      email: string;
      password: string;
      tenantId: string;
    },
  ) {
    return this.authService.signup(body);
  }

  @Public()
  @Post('register-tenant')
  async registerTenant(
    @Body()
    body: {
      officeName: string;
      documentType: string;
      documentNumber: string;
      cep: string;
      address: string;
      email: string;
      phone: string;
      ownerName: string;
      password: string;
      paymentCompleted: boolean;
      preapprovalId?: string;
    },
  ) {
    return this.authService.registerTenant(body);
  }

  @Public()
  @Post('register-admin')
  async registerAdmin(@Body() body: RegisterAdminDto) {
    return this.authService.registerAdmin(body);
  }

  @Public()
  @Post('login')
  async login(@Body() body: LoginDto, @Req() req: Request) {
    return this.authService.login(body.email, body.password, req);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: UserPayload) {
    // Se não tem usuário, já está desconectado
    if (!user?.id) {
      return { message: 'Logout realizado com sucesso' };
    }
    
    return this.authService.logout(user.id, user.sessionToken);
  }
}