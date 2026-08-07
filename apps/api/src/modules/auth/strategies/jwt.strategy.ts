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
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          const cookies = req?.cookies;
          if (!cookies) return null;
          const kind = resolveAppKind(req, config);
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

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Недействительный токен');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { status: true, sessionVersion: true },
    });

    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Сессия недействительна');
    }

    if (
      payload.sessionVersion !== undefined &&
      payload.sessionVersion !== user.sessionVersion
    ) {
      throw new UnauthorizedException('Сессия устарела');
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
