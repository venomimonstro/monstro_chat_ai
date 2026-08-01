import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { generateSecret, generateURI, verify } from 'otplib';
import { randomUUID, randomBytes, createHash } from 'crypto';
import { Request, Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../common/email/email.service';
import { TokenService } from './token.service';
import { TwoFaCryptoService } from './two-fa-crypto.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { AccessTokenPayload } from '../../common/interfaces/jwt-payload.interface';
import { ROLES_REQUIRING_2FA } from '../../common/constants/permissions';
import {
  ACCESS_COOKIE_ADMIN,
  ACCESS_COOKIE_CLIENT,
  CSRF_COOKIE,
  REFRESH_COOKIE,
} from '../../common/constants/cookies';
import {
  accessCookieName,
  resolveAppKind,
  type AppKind,
} from '../../common/utils/request-app.util';
import { User, UserRole } from '@prisma/client';

const TRIAL_DAYS = 7;

export interface AuthTokensResponse {
  accessToken?: string;
  user: {
    id: string;
    email: string;
    role: UserRole;
    tenantId: string | null;
  };
  requires2fa?: boolean;
  requires2faSetup?: boolean;
  twoFaToken?: string;
}

@Injectable()
export class AuthService {
  private readonly accessTtl: '15m' | '5m' | '30m' | '1h' | string;
  private readonly twoFaTtl: '5m' | string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
    private readonly tokenService: TokenService,
    private readonly twoFaCrypto: TwoFaCryptoService,
  ) {
    this.accessTtl = this.config.get<string>('JWT_ACCESS_TTL', '15m');
    this.twoFaTtl = this.config.get<string>('JWT_2FA_TTL', '5m');
  }

  async register(
    dto: RegisterDto,
    res: Response,
    req: Request,
  ): Promise<AuthTokensResponse> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('Пользователь с таким email уже существует');
    }

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });

    const trialEndsAt = this.getTrialEndsAt();

    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.companyName,
          status: 'active',
          trialEndsAt,
        },
      });

      const user = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          passwordHash,
          role: 'client',
          tenantId: tenant.id,
        },
      });

      await tx.tenant.update({
        where: { id: tenant.id },
        data: { ownerUserId: user.id },
      });

      const defaultTariff = await tx.tariff.findFirst({
        where: dto.tariffId
          ? { id: dto.tariffId, isActive: true }
          : { name: 'Start', isActive: true },
      });

      if (defaultTariff) {
        await tx.subscription.create({
          data: {
            tenantId: tenant.id,
            tariffId: defaultTariff.id,
            status: 'trialing',
            currentPeriodEnd: trialEndsAt,
          },
        });
      }

      return { user, tenant };
    });

    await this.emailService.sendRegistrationConfirmation(
      result.user.email,
      dto.companyName,
    );

    return this.issueTokens(result.user, res, req, true);
  }

  getTrialEndsAt(from: Date = new Date()): Date {
    const date = new Date(from);
    date.setDate(date.getDate() + TRIAL_DAYS);
    return date;
  }

  async login(
    dto: LoginDto,
    res: Response,
    req: Request,
  ): Promise<AuthTokensResponse> {
    const rateLimit = await this.tokenService.checkLoginRateLimit(dto.email);
    if (!rateLimit.allowed) {
      throw new HttpException(
        {
          message: 'Слишком много попыток входа. Попробуйте позже.',
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    await this.tokenService.resetLoginAttempts(dto.email);

    if (this.requires2fa(user)) {
      if (user.twoFaEnabled && user.twoFaSecret) {
        const twoFaToken = this.signTwoFaToken(user);
        return {
          user: this.sanitizeUser(user),
          requires2fa: true,
          twoFaToken,
        };
      }
      const tokens = await this.issueTokens(user, res, req, false);
      return { ...tokens, requires2faSetup: true };
    }

    return this.issueTokens(user, res, req, true);
  }

  async verify2fa(
    code: string,
    twoFaToken: string,
    res: Response,
    req: Request,
  ): Promise<AuthTokensResponse> {
    let payload: AccessTokenPayload;
    try {
      payload = this.jwtService.verify<AccessTokenPayload>(twoFaToken);
    } catch {
      throw new UnauthorizedException('Недействительный 2FA-токен');
    }

    if (payload.type !== 'two_fa') {
      throw new UnauthorizedException('Недействительный 2FA-токен');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.twoFaSecret || !user.twoFaEnabled) {
      throw new UnauthorizedException('2FA не настроена');
    }

    const secret = this.twoFaCrypto.decrypt(user.twoFaSecret);
    if (!secret) {
      throw new UnauthorizedException('Не удалось расшифровать секрет 2FA');
    }

    const valid = await verify({
      token: code,
      secret,
    });

    if (!valid) {
      throw new UnauthorizedException('Неверный код 2FA');
    }

    return this.issueTokens(user, res, req, true);
  }

  async setup2fa(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const secret = generateSecret();
    const otpauthUrl = generateURI({
      issuer: 'AI-Консультант',
      label: user.email,
      secret,
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFaSecret: this.twoFaCrypto.encrypt(secret) },
    });

    return { secret, otpauthUrl };
  }

  async enable2fa(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.twoFaSecret) {
      throw new BadRequestException('Сначала выполните setup 2FA');
    }

    const secret = this.twoFaCrypto.decrypt(user.twoFaSecret);
    if (!secret) {
      throw new BadRequestException('Не удалось расшифровать секрет 2FA');
    }

    const valid = await verify({
      token: code,
      secret,
    });

    if (!valid) {
      throw new BadRequestException('Неверный код 2FA');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFaEnabled: true },
    });
  }

  async findUserById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async issueTokensForUser(
    user: User,
    res: Response,
    req: Request,
    twoFaVerified: boolean,
  ) {
    return this.issueTokens(user, res, req, twoFaVerified);
  }

  async disable2fa(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    if (ROLES_REQUIRING_2FA.includes(user.role as 'owner' | 'admin')) {
      throw new ForbiddenException(
        '2FA обязательна для ролей owner и admin и не может быть отключена',
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFaEnabled: false,
        twoFaSecret: null,
        sessionVersion: { increment: 1 },
      },
    });

    await this.revokeAllSessions(userId);

    return { success: true };
  }

  async revokeAllSessions(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { sessionVersion: { increment: 1 } },
    });
  }

  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (user) {
      const token = randomBytes(32).toString('base64url');
      const tokenHash = createHash('sha256').update(token).digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await this.prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      });

      const webClientUrl = this.config.get('WEB_CLIENT_URL', 'http://localhost:5173');
      const resetUrl = `${webClientUrl}/reset-password?token=${token}`;
      await this.emailService.sendPasswordReset(user.email, resetUrl);
    }
    return { success: true };
  }

  async resetPassword(token: string, password: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const row = await this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!row) {
      throw new BadRequestException('Ссылка недействительна или истекла');
    }

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: row.userId },
        data: { passwordHash, sessionVersion: { increment: 1 } },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { success: true };
  }

  async refresh(
    refreshToken: string,
    res: Response,
    req: Request,
  ): Promise<{ success: true }> {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token отсутствует');
    }

    const data = await this.tokenService.validateRefreshToken(refreshToken);
    if (!data) {
      throw new UnauthorizedException('Недействительный refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: data.userId },
    });

    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Пользователь не найден');
    }

    if (
      data.sessionVersion !== undefined &&
      data.sessionVersion !== user.sessionVersion
    ) {
      throw new UnauthorizedException('Сессия устарела');
    }

    const accessToken = this.signAccessToken(
      user,
      data.twoFaVerified ?? false,
    );
    this.applyAccessSession(res, req, accessToken);
    return { success: true };
  }

  async logout(refreshToken: string, res: Response) {
    if (refreshToken) {
      await this.tokenService.revokeRefreshToken(refreshToken);
    }
    this.clearSessionCookies(res);
    return { success: true };
  }

  createWsToken(user: User): string {
    return this.signAccessToken(user, true);
  }

  applyAccessSession(
    res: Response,
    req: Request,
    accessToken: string,
    app?: AppKind,
  ) {
    const kind = app ?? resolveAppKind(req, this.config.get('WEB_ADMIN_URL'));
    this.setAccessCookie(res, accessToken, kind);
    this.setCsrfCookie(res);
  }

  private async issueTokens(
    user: User,
    res: Response,
    req: Request,
    twoFaVerified: boolean,
  ): Promise<AuthTokensResponse> {
    const tokenId = randomUUID();
    await this.tokenService.storeRefreshToken({
      userId: user.id,
      tenantId: user.tenantId,
      tokenId,
      twoFaVerified,
      sessionVersion: user.sessionVersion,
    });

    this.setRefreshCookie(res, tokenId);

    const accessToken = this.signAccessToken(user, twoFaVerified);
    this.applyAccessSession(res, req, accessToken);

    return {
      user: this.sanitizeUser(user),
    };
  }

  private signAccessToken(user: User, twoFaVerified: boolean): string {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      type: 'access',
      twoFaVerified,
    };
    return this.jwtService.sign(payload, { expiresIn: this.accessTtl as never });
  }

  private signTwoFaToken(user: User): string {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      type: 'two_fa',
    };
    return this.jwtService.sign({ ...payload }, { expiresIn: '5m' });
  }

  private requires2fa(user: User): boolean {
    if (this.config.get<string>('SKIP_2FA_ENFORCEMENT') === 'true') {
      return false;
    }
    return ROLES_REQUIRING_2FA.includes(user.role as 'owner' | 'admin');
  }

  private sanitizeUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    };
  }

  /** Secure cookies require HTTPS; allow HTTP deploy via COOKIE_SECURE=false */
  private cookiesSecure(): boolean {
    const explicit = this.config.get<string>('COOKIE_SECURE');
    if (explicit === 'true' || explicit === '1') return true;
    if (explicit === 'false' || explicit === '0') return false;
    const publicUrl = this.config.get<string>('API_PUBLIC_URL', '');
    return publicUrl.startsWith('https://');
  }

  setRefreshCookie(res: Response, tokenId: string) {
    res.cookie(REFRESH_COOKIE, tokenId, {
      httpOnly: true,
      secure: this.cookiesSecure(),
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/api/auth',
    });
  }

  private setAccessCookie(res: Response, token: string, app: AppKind) {
    res.cookie(accessCookieName(app), token, {
      httpOnly: true,
      secure: this.cookiesSecure(),
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
      path: '/api',
    });
  }

  private setCsrfCookie(res: Response) {
    const token = randomBytes(32).toString('hex');
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false,
      secure: this.cookiesSecure(),
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }

  clearSessionCookies(res: Response) {
    const secure = this.cookiesSecure();
    const apiBase = {
      path: '/api',
      secure,
      sameSite: 'lax' as const,
    };
    res.clearCookie(ACCESS_COOKIE_CLIENT, apiBase);
    res.clearCookie(ACCESS_COOKIE_ADMIN, apiBase);
    res.clearCookie(CSRF_COOKIE, { path: '/', secure, sameSite: 'lax' });
    this.clearRefreshCookie(res);
  }

  clearRefreshCookie(res: Response) {
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  }

  getRefreshCookieName() {
    return REFRESH_COOKIE;
  }
}
