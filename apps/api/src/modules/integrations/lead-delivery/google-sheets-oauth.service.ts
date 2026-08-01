import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

export interface GoogleSheetsTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  mock?: boolean;
}

interface OAuthStatePayload {
  tenantId: string;
  channelId: string;
  purpose: 'google-sheets-oauth';
}

@Injectable()
export class GoogleSheetsOAuthService {
  private readonly logger = new Logger(GoogleSheetsOAuthService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  buildConnectUrl(tenantId: string, channelId: string) {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    const redirectUri = this.getRedirectUri();
    if (!clientId) {
      throw new BadRequestException(
        'Google OAuth не настроен. Используйте mock-подключение в dev-режиме.',
      );
    }

    const state = this.jwt.sign(
      { tenantId, channelId, purpose: 'google-sheets-oauth' } satisfies OAuthStatePayload,
      { expiresIn: '15m' },
    );

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  verifyState(state: string): OAuthStatePayload {
    const payload = this.jwt.verify<OAuthStatePayload>(state);
    if (payload.purpose !== 'google-sheets-oauth') {
      throw new BadRequestException('Неверный state OAuth');
    }
    return payload;
  }

  async exchangeCode(code: string): Promise<GoogleSheetsTokens> {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET');
    const redirectUri = this.getRedirectUri();
    if (!clientId || !clientSecret) {
      throw new BadRequestException('Google OAuth не настроен');
    }

    const fetchFn = this.config.get<typeof fetch>('CRM_HTTP_FETCH') ?? fetch;
    const response = await fetchFn('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const data = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
    };

    if (!data.access_token) {
      throw new BadRequestException(data.error ?? 'Ошибка обмена Google OAuth');
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? '',
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    };
  }

  createMockTokens(): GoogleSheetsTokens {
    if (this.config.get<string>('NODE_ENV') === 'production') {
      throw new BadRequestException('Mock Google OAuth недоступен в production');
    }
    return {
      accessToken: 'mock-access',
      refreshToken: 'mock-refresh',
      expiresAt: Date.now() + 3600_000,
      mock: true,
    };
  }

  async ensureAccessToken(tokens: GoogleSheetsTokens): Promise<string> {
    if (tokens.mock) return tokens.accessToken;
    if (tokens.expiresAt > Date.now() + 60_000) {
      return tokens.accessToken;
    }
    if (!tokens.refreshToken) {
      throw new Error('Google OAuth: refresh token отсутствует');
    }

    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth не настроен');
    }

    const fetchFn = this.config.get<typeof fetch>('CRM_HTTP_FETCH') ?? fetch;
    const response = await fetchFn('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokens.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const data = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
    };

    if (!data.access_token) {
      throw new Error(data.error ?? 'Не удалось обновить Google token');
    }

    tokens.accessToken = data.access_token;
    tokens.expiresAt = Date.now() + (data.expires_in ?? 3600) * 1000;
    return tokens.accessToken;
  }

  private getRedirectUri() {
    const apiUrl = this.config.get<string>(
      'API_PUBLIC_URL',
      'http://localhost:3000/api',
    );
    return `${apiUrl.replace(/\/$/, '')}/integrations/lead-delivery/google-sheets/callback`;
  }
}
