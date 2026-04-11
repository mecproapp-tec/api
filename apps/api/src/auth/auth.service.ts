import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../shared/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { PaymentService } from '../payments/payment.service';
import { Request } from 'express';
import { RegisterAdminDto } from './dto/register-admin.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private paymentService: PaymentService,
  ) {}

  async signup(data: {
    name: string;
    email: string;
    password: string;
    tenantId: string;
  }) {
    const hashed = await bcrypt.hash(data.password, 10);

    const user = await this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashed,
        tenantId: data.tenantId,
      },
    });

    return user;
  }

  async registerTenant(data: {
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
  }) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existingUser)
      throw new BadRequestException('Email já cadastrado');

    const existingTenant = await this.prisma.tenant.findUnique({
      where: { documentNumber: data.documentNumber },
    });
    if (existingTenant)
      throw new BadRequestException('Documento já cadastrado');

    if (!data.preapprovalId) {
      throw new BadRequestException(
        'ID da assinatura não fornecido.',
      );
    }

    const subscriptionData = await this.paymentService.getSubscription(
      data.preapprovalId,
    );

    if (subscriptionData.status !== 'authorized') {
      throw new BadRequestException(
        'Assinatura não autorizada ou pendente.',
      );
    }

    const trialEndsAt = new Date(
      subscriptionData.next_payment_date,
    );

    const tenant = await this.prisma.tenant.create({
      data: {
        name: data.officeName,
        documentType: data.documentType,
        documentNumber: data.documentNumber,
        cep: data.cep,
        address: data.address,
        email: data.email,
        phone: data.phone,
        status: 'ACTIVE',
        trialEndsAt,
        subscriptionId: data.preapprovalId,
        paymentStatus: 'trial',
      },
    });

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await this.prisma.user.create({
      data: {
        name: data.ownerName,
        email: data.email,
        password: hashedPassword,
        role: 'OWNER',
        tenantId: tenant.id,
      },
    });

    const sessionToken = this.generateSessionToken();

    await this.prisma.userSession.create({
      data: {
        userId: user.id,
        sessionToken,
        ipAddress: '',
        userAgent: 'system',
        lastActivity: new Date(),
      },
    });

    const payload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role,
      sessionToken,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.generateRefreshToken();

    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000,
        ),
      },
    });

    return {
      message: 'Cadastro realizado com sucesso',
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        officeName: tenant.name,
      },
    };
  }

  async registerAdmin(data: RegisterAdminDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser)
      throw new BadRequestException('Email já cadastrado');

    const ADMIN_TENANT_ID =
      '00000000-0000-0000-0000-000000000001';

    let tenant = await this.prisma.tenant.findUnique({
      where: { id: ADMIN_TENANT_ID },
    });

    if (!tenant) {
      tenant = await this.prisma.tenant.create({
        data: {
          id: ADMIN_TENANT_ID,
          name: 'Administração',
          documentType: 'ADMIN',
          documentNumber: '00000000000000',
          cep: '00000000',
          address: 'Sistema',
          email: 'admin@mecpro.com',
          phone: '0000000000',
          status: 'ACTIVE',
        },
      });
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        tenantId: tenant.id,
      },
    });

    return {
      message: 'Administrador cadastrado com sucesso',
      user,
    };
  }

  async login(email: string, password: string, req: Request) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { tenant: true },
    });

    if (!user)
      throw new UnauthorizedException('Usuário não encontrado');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      throw new UnauthorizedException('Senha incorreta');

    if (!user.tenantId) {
      throw new UnauthorizedException('Usuário sem tenant');
    }

    // Remove sessões antigas
    await this.prisma.userSession.deleteMany({
      where: { userId: user.id },
    });

    const sessionToken = this.generateSessionToken();

    await this.prisma.userSession.create({
      data: {
        userId: user.id,
        sessionToken,
        ipAddress: req.ip || '',
        userAgent: req.headers['user-agent'] || '',
        lastActivity: new Date(),
      },
    });

    const payload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role,
      sessionToken,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.generateRefreshToken();

    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000,
        ),
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        officeName: user.tenant?.name || null,
        role: user.role,
      },
    };
  }

  async logout(userId: number, sessionToken: string) {
    try {
      // Deleta apenas a sessão específica
      await this.prisma.userSession.deleteMany({
        where: { 
          userId: userId,
          sessionToken: sessionToken 
        },
      });
      
      return { message: 'Logout realizado com sucesso' };
    } catch (error) {
      // Mesmo se falhar, retorna sucesso (o token vai expirar naturalmente)
      return { message: 'Logout realizado com sucesso' };
    }
  }

  async refreshToken(token: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!stored)
      throw new UnauthorizedException('Refresh token inválido');

    const user = stored.user;

    const session = await this.prisma.userSession.findFirst({
      where: { userId: user.id },
    });

    if (!session)
      throw new UnauthorizedException('Sessão não encontrada');

    const payload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role,
      sessionToken: session.sessionToken,
    };

    const accessToken = this.jwtService.sign(payload);

    return { accessToken };
  }

  generateRefreshToken() {
    return require('crypto')
      .randomBytes(64)
      .toString('hex');
  }

  generateSessionToken() {
    return require('crypto')
      .randomBytes(32)
      .toString('hex');
  }
}