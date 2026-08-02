import {
  ForbiddenException,
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';
import {
  ACCESS_COOKIE_ADMIN,
  ACCESS_COOKIE_CLIENT,
  CSRF_COOKIE,
  REFRESH_COOKIE,
} from '../constants/cookies';
import { CsrfTokenService } from '../../modules/auth/csrf-token.service';
import { TokenService } from '../../modules/auth/token.service';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const CSRF_SKIP_PREFIXES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/refresh',
  '/api/auth/logout',
  '/api/auth/2fa/verify',
  '/api/auth/me',
  '/api/auth/ws-token',
  '/api/auth/csrf',
  '/api/admin/impersonation/exchange',
  '/api/admin',
  '/api/billing/webhook/',
  '/api/widget/',
  '/api/public/',
  '/api/health',
];

const CSRF_HEADER_RE = /^[a-f0-9]{64}$/i;

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  constructor(
    private readonly csrfTokens: CsrfTokenService,
    private readonly tokenService: TokenService,
    private readonly config: ConfigService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }

    const path = req.originalUrl.split('?')[0];
    if (CSRF_SKIP_PREFIXES.some((prefix) => path.startsWith(prefix))) {
      next();
      return;
    }

    const headerToken = req.headers['x-csrf-token'] as string | undefined;
    const cookieToken = req.cookies?.[CSRF_COOKIE] as string | undefined;
    const refreshToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    const hasAccessSession = !!(
      req.cookies?.[ACCESS_COOKIE_ADMIN] || req.cookies?.[ACCESS_COOKIE_CLIENT]
    );

    if (!headerToken || !CSRF_HEADER_RE.test(headerToken)) {
      throw new ForbiddenException('Недействительный CSRF-токен');
    }

    if (cookieToken && cookieToken === headerToken) {
      if (refreshToken) {
        await this.csrfTokens.bind(refreshToken, headerToken);
      }
      next();
      return;
    }

    if (refreshToken && (await this.csrfTokens.validate(refreshToken, headerToken))) {
      if (!cookieToken) {
        this.setCsrfCookie(res, headerToken);
      }
      next();
      return;
    }

    // SPA: custom header blocks cross-site form CSRF; session cookie proves login
    if (hasAccessSession || refreshToken) {
      if (refreshToken) {
        await this.csrfTokens.bind(refreshToken, headerToken);
      }
      if (!cookieToken) {
        this.setCsrfCookie(res, headerToken);
      }
      next();
      return;
    }

    throw new ForbiddenException('Недействительный CSRF-токен');
  }

  private setCsrfCookie(res: Response, token: string) {
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false,
      secure: this.cookiesSecure(),
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }

  private cookiesSecure(): boolean {
    const explicit = this.config.get<string>('COOKIE_SECURE');
    if (explicit === 'true' || explicit === '1') return true;
    if (explicit === 'false' || explicit === '0') return false;
    const publicUrl = this.config.get<string>('API_PUBLIC_URL', '');
    return publicUrl.startsWith('https://');
  }
}
