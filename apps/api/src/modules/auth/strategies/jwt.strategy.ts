import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import {
  AccessTokenPayload,
  AuthenticatedUser,
} from '../../../common/interfaces/jwt-payload.interface';
import {
  ACCESS_COOKIE_ADMIN,
  ACCESS_COOKIE_CLIENT,
} from '../../../common/constants/cookies';
import { resolveAppKind } from '../../../common/utils/request-app.util';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          const cookies = req?.cookies;
          if (!cookies) return null;
          const kind = resolveAppKind(req, config.get('WEB_ADMIN_URL', 'http://localhost:5174'));
          if (kind === 'admin') {
            return (
              (cookies[ACCESS_COOKIE_ADMIN] as string | undefined) ??
              (cookies[ACCESS_COOKIE_CLIENT] as string | undefined) ??
              null
            );
          }
          return (
            (cookies[ACCESS_COOKIE_CLIENT] as string | undefined) ??
            (cookies[ACCESS_COOKIE_ADMIN] as string | undefined) ??
            null
          );
        },
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  validate(payload: AccessTokenPayload): AuthenticatedUser {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Недействительный токен');
    }

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      tenantId: payload.tenantId,
      twoFaVerified: payload.twoFaVerified ?? false,
      impersonatedBy: payload.impersonatedBy,
      impersonationActorEmail: payload.impersonationActorEmail,
      impersonationReason: payload.impersonationReason,
    };
  }
}
