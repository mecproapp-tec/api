import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { PrismaModule } from '../shared/prisma/prisma.module';
import { PaymentModule } from '../payments/payment.module';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

// 🔐 STRATEGY
import { JwtStrategy } from './guards/jwt.strategy';

// 🔐 GUARDS
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { SessionGuard } from './guards/session.guard';
import { BillingGuard } from './guards/billing.guard';

// (opcional)
import { RolesGuard } from './roles.guard';

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    ConfigModule,

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret:
          configService.get<string>('JWT_SECRET') ||
          'SUPER_SECRET_KEY',
        signOptions: { expiresIn: '7d' },
      }),
    }),

    PaymentModule,
  ],

  controllers: [AuthController],

  providers: [
    AuthService,
    JwtStrategy,

    // 🔥 GUARDS REGISTRADOS
    JwtAuthGuard,
    SessionGuard,
    BillingGuard,

    // opcional
    RolesGuard,
  ],

  exports: [
    AuthService,
    JwtModule,

    // 🔥 EXPORTA PARA OUTROS MÓDULOS
    JwtAuthGuard,
    SessionGuard,
    BillingGuard,
    RolesGuard,
  ],
})
export class AuthModule {}