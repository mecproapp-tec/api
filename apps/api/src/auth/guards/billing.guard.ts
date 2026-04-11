import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class BillingGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // 🔥 VERIFICAÇÃO 1: Usuário autenticado
    if (!user) {
      throw new UnauthorizedException('Usuário não autenticado');
    }

    // 🔥 VERIFICAÇÃO 2: Tenant existe no token
    if (!user.tenantId) {
      throw new UnauthorizedException('Tenant não encontrado no token');
    }

    // 🔥 SUPER_ADMIN tem acesso total (sem verificar billing)
    if (user.role === 'SUPER_ADMIN') {
      return true;
    }

    // 🔥 VERIFICAÇÃO 3: Buscar tenant no banco
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
    });

    if (!tenant) {
      throw new UnauthorizedException('Tenant não encontrado no sistema');
    }

    // 🔥 VERIFICAÇÃO 4: Status do tenant
    if (tenant.status !== 'ACTIVE') {
      throw new ForbiddenException(
        'Sua conta está inativa. Entre em contato com o suporte.'
      );
    }

    // 🔥 VERIFICAÇÃO 5: Status de pagamento
    const allowedPaymentStatuses = ['paid', 'trial'];
    
    if (!allowedPaymentStatuses.includes(tenant.paymentStatus ?? '')) {
      throw new ForbiddenException(
        'Pagamento pendente. Acesse o link de pagamento para regularizar sua assinatura.'
      );
    }

    // 🔥 VERIFICAÇÃO 6: Trial expirado
    if (
      tenant.paymentStatus === 'trial' &&
      tenant.trialEndsAt &&
      new Date() > new Date(tenant.trialEndsAt)
    ) {
      throw new ForbiddenException(
        'Seu período de teste expirou. Faça o upgrade para continuar usando o sistema.'
      );
    }

    return true;
  }
}