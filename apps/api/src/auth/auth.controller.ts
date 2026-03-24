import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  async signup(@Body() body: { name: string; email: string; password: string; tenantId: string }) {
    return this.authService.signup(body);
  }

  @Post('register-tenant')
  async registerTenant(@Body() body: {
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
    pendingId?: string;
  }) {
    return this.authService.registerTenant(body);
  }

  @Post('register-admin')
  async registerAdmin(@Body() body: { name: string; email: string; password: string }) {
    return this.authService.registerAdmin(body);
  }

  @Post('login')
  async login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }
}