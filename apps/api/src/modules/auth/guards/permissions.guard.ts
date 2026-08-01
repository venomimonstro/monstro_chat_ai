import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../../../common/decorators/auth.decorators';
import { RbacService } from '../../../common/rbac/rbac.service';
import { AuthenticatedUser } from '../../../common/interfaces/jwt-payload.interface';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private rbac: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.authUser as AuthenticatedUser | undefined;

    if (!user) {
      throw new ForbiddenException('Доступ запрещён');
    }

    for (const permission of required) {
      const allowed = await this.rbac.hasPermission(user.role, permission);
      if (!allowed) {
        throw new ForbiddenException(`Недостаточно прав: ${permission}`);
      }
    }

    return true;
  }
}
