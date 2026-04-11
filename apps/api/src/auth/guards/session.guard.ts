import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Se não tem usuário, deixa o JwtAuthGuard lidar
    if (!user) {
      return true;
    }

    // Se não tem sessionToken, não valida (pode ser SUPER_ADMIN ou token antigo)
    if (!user.sessionToken) {
      // SUPER_ADMIN pode passar sem session token
      if (user.role === 'SUPER_ADMIN') {
        return true;
      }
      // Para outros roles, exige session token
      throw new UnauthorizedException('Sessão inválida. Faça login novamente.');
    }

    // Verifica se a sessão existe no banco
    const session = await this.prisma.userSession.findFirst({
      where: {
        userId: user.id,
        sessionToken: user.sessionToken,
      },
    });

    if (!session) {
      throw new UnauthorizedException(
        'Sessão expirada ou inválida. Faça login novamente.'
      );
    }

    // Atualiza o último acesso (opcional)
    await this.prisma.userSession.update({
      where: { id: session.id },
      data: { lastActivity: new Date() },
    });

    return true;
  }
}