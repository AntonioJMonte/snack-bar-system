import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@prisma/client';
import type { AuthenticatedRequest } from './jwt-auth.guard';
import { MIN_ROLE_KEY } from './min-role.decorator';
import { roleAtLeast } from './roles';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const minRole = this.reflector.getAllAndOverride<Role | undefined>(MIN_ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!minRole) return true;

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!user || !roleAtLeast(user.role, minRole)) {
      // Um atendente não altera preço nem chamando a API diretamente (12.2).
      throw new ForbiddenException({ code: 'INSUFFICIENT_ROLE', minRole });
    }
    return true;
  }
}
