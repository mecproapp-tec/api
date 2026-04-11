import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

@Injectable()
export class SessionGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Por enquanto, sempre retorna true
    // Em produção, você pode implementar a validação de sessão
    return true;
  }
}