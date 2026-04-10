import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../shared/prisma/prisma.service'; // ✅ corrigido

@Injectable()
export class RefreshTokenGuard implements CanActivate {
  constructor(private jwtService: JwtService, private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const token = req.headers['authorization']?.replace('Bearer ', '');
    if (!token) throw new UnauthorizedException('Token ausente');

    try {
      const payload = this.jwtService.verify(token);
      const user = await this.prisma.user.findUnique({ where: { id: Number(payload.sub) } });
      if (!user) throw new UnauthorizedException('Usuário não encontrado');
      req.user = user;
      return true;
    } catch (err) {
      throw new UnauthorizedException('Token inválido');
    }
  }
}