import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import {
  IS_PUBLIC_KEY,
  ALLOW_2FA_SETUP_KEY,
} from '../../../common/decorators/auth.decorators';
import { ROLES_REQUIRING_2FA } from '../../../common/constants/permissions';
import { AuthenticatedUser } from '../../../common/interfaces/jwt-payload.interface';

@Injectable()
export class TwoFaRequiredGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.config.get<string>('SKIP_2FA_ENFORCEMENT') === 'true') {
      return true;
    }
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const allowSetup = this.reflector.getAllAndOverride<boolean>(
      ALLOW_2FA_SETUP_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest();
    const user = request.authUser as AuthenticatedUser | undefined;

    if (!user) return true;

    const requires2fa = ROLES_REQUIRING_2FA.includes(
      user.role as 'owner' | 'admin',
    );

    if (requires2fa && !user.twoFaVerified && !allowSetup) {
      throw new UnauthorizedException('Требуется настройка или подтверждение 2FA');
    }

    return true;
  }
}
