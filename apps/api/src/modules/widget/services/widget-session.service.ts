import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

export interface WidgetSessionClaims {
  purpose: 'widget-session';
  widgetKey: string;
  visitorId: string;
  dialogId?: string;
}

export interface WidgetSessionVerifyInput {
  widgetKey: string;
  visitorId: string;
  dialogId?: string;
}

@Injectable()
export class WidgetSessionService {
  private readonly ttlSeconds: number;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.ttlSeconds = config.get<number>('WIDGET_SESSION_TTL_SEC', 86_400);
  }

  issueToken(input: WidgetSessionVerifyInput): string {
    const payload: WidgetSessionClaims = {
      purpose: 'widget-session',
      widgetKey: input.widgetKey,
      visitorId: input.visitorId,
      ...(input.dialogId ? { dialogId: input.dialogId } : {}),
    };
    return this.jwt.sign(payload, { expiresIn: this.ttlSeconds });
  }

  assertToken(token: string | undefined, expected: WidgetSessionVerifyInput): void {
    if (!token?.trim()) {
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'WIDGET_SESSION_REQUIRED',
        message: 'Требуется сессия виджета',
      });
    }

    let claims: WidgetSessionClaims;
    try {
      claims = this.jwt.verify<WidgetSessionClaims>(token);
    } catch {
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'WIDGET_SESSION_INVALID',
        message: 'Сессия виджета недействительна',
      });
    }

    if (claims.purpose !== 'widget-session') {
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'WIDGET_SESSION_INVALID',
        message: 'Сессия виджета недействительна',
      });
    }

    if (
      claims.widgetKey !== expected.widgetKey ||
      claims.visitorId !== expected.visitorId
    ) {
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'WIDGET_SESSION_MISMATCH',
        message: 'Сессия не соответствует запросу',
      });
    }

    if (
      expected.dialogId &&
      claims.dialogId &&
      claims.dialogId !== expected.dialogId
    ) {
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'WIDGET_SESSION_MISMATCH',
        message: 'Сессия не соответствует диалогу',
      });
    }
  }
}
