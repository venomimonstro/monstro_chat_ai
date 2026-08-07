import {
  Controller,
  Post,
  Body,
  Res,
  Req,
  Get,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RbacService } from '../../common/rbac/rbac.service';
import { UserRole } from '@prisma/client';
import {
  RegisterDto,
  LoginDto,
  TwoFaVerifyDto,
  TwoFaEnableDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import { Public, Allow2faSetup } from '../../common/decorators/auth.decorators';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { CSRF_COOKIE } from '../../common/constants/cookies';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly rbac: RbacService,
  ) {}

  @Public()
  @Get('csrf')
  async csrfToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = await this.authService.syncOrCreateCsrfToken(req, res);
    return { token };
  }

  @Public()
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.register(dto, res, req);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.login(dto, res, req);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[this.authService.getRefreshCookieName()];
    return this.authService.refresh(token, res, req);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[this.authService.getRefreshCookieName()];
    return this.authService.logout(token, res);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('2fa/verify')
  @HttpCode(HttpStatus.OK)
  async verify2fa(
    @Body() dto: TwoFaVerifyDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.verify2fa(dto.code, dto.twoFaToken, res, req);
  }

  @Post('2fa/setup')
  @Allow2faSetup()
  @UseGuards(JwtAuthGuard)
  async setup2fa(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.setup2fa(user.id);
  }

  @Post('2fa/enable')
  @Allow2faSetup()
  @UseGuards(JwtAuthGuard)
  async enable2fa(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TwoFaEnableDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.enable2fa(user.id, dto.code);
    const dbUser = await this.authService.findUserById(user.id);
    return this.authService.issueTokensForUser(dbUser!, res, req, true);
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  async disable2fa(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.disable2fa(user.id);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  @Post('ws-token')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async wsToken(@CurrentUser() user: AuthenticatedUser) {
    const dbUser = await this.authService.findUserById(user.id);
    if (!dbUser) {
      return { token: null };
    }
    return { token: this.authService.createWsToken(dbUser) };
  }

  @Post('me')
  @Allow2faSetup()
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthenticatedUser) {
    const permissions = await this.rbac.getPermissionsForRole(
      user.role as UserRole,
    );
    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        permissions,
        impersonation: user.impersonatedBy
          ? {
              actorUserId: user.impersonatedBy,
              actorEmail: user.impersonationActorEmail ?? '',
              reason: user.impersonationReason,
            }
          : null,
      },
    };
  }
}
