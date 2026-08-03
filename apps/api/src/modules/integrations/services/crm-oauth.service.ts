import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { IntegrationStatus, IntegrationType } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CredentialCryptoService } from './credential-crypto.service';
import type { CrmOAuthTokens } from './crm-export.service';

type CrmProviderType = 'amocrm' | 'bitrix24';

interface OAuthStatePayload {
  tenantId: string;
  type: CrmProviderType;
  purpose: 'crm-oauth';
}

@Injectable()
export class CrmOAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CredentialCryptoService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  buildConnectUrl(tenantId: string, type: CrmProviderType) {
    const clientId = this.getClientId(type);
    const redirectUri = this.getRedirectUri(type);
    if (!clientId) {
      throw new BadRequestException(
        'OAuth не настроен. Используйте mock-подключение в dev-режиме.',
      );
    }

    const state = this.jwt.sign(
      { tenantId, type, purpose: 'crm-oauth' } satisfies OAuthStatePayload,
      { expiresIn: '15m' },
    );

    if (type === 'amocrm') {
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        state,
        mode: 'post_message',
      });
      return `https://www.amocrm.ru/oauth?${params}`;
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state,
    });
    return `https://oauth.bitrix.info/oauth/authorize/?${params}`;
  }

  async handleCallback(
    type: CrmProviderType,
    code: string,
    state: string,
    referer?: string,
  ) {
    const payload = this.verifyState(state, type);
    const tokens = await this.exchangeCode(type, code, referer);
    await this.saveIntegration(payload.tenantId, type, tokens);
    return payload.tenantId;
  }

  async connectMock(
    tenantId: string,
    type: CrmProviderType,
  ) {
    if (this.config.get<string>('NODE_ENV') === 'production') {
      throw new BadRequestException('Mock-подключение недоступно в production');
    }

    const tokens: CrmOAuthTokens = {
      accessToken: `mock-access-${type}`,
      refreshToken: `mock-refresh-${type}`,
      expiresAt: Date.now() + 86_400_000,
      accountDomain: type === 'amocrm' ? 'mock.amocrm.ru' : undefined,
      portalDomain: type === 'bitrix24' ? 'mock.bitrix24.ru' : undefined,
      mock: true,
    };
    await this.saveIntegration(tenantId, type, tokens);
  }

  async disconnect(tenantId: string, type: IntegrationType) {
    await this.prisma.integration.deleteMany({
      where: { tenantId, type },
    });
  }

  private async saveIntegration(
    tenantId: string,
    type: CrmProviderType,
    tokens: CrmOAuthTokens,
  ) {
    const integrationType = type as IntegrationType;
    const encrypted = this.crypto.encrypt(JSON.stringify(tokens));
    const existing = await this.prisma.integration.findUnique({
      where: { tenantId_type: { tenantId, type: integrationType } },
    });
    const prevConfig = (existing?.configJson ?? {}) as Record<string, unknown>;
    const configJson = {
      ...prevConfig,
      accountDomain: tokens.accountDomain,
      portalDomain: tokens.portalDomain,
      mock: Boolean(tokens.mock),
    };

    await this.prisma.integration.upsert({
      where: { tenantId_type: { tenantId, type: integrationType } },
      create: {
        tenantId,
        type: integrationType,
        status: IntegrationStatus.active,
        credentialsEncrypted: encrypted,
        configJson,
      },
      update: {
        status: IntegrationStatus.active,
        credentialsEncrypted: encrypted,
        configJson,
      },
    });
  }

  private verifyState(
    state: string,
    expectedType: CrmProviderType,
  ): OAuthStatePayload {
    try {
      const payload = this.jwt.verify<OAuthStatePayload>(state);
      if (payload.purpose !== 'crm-oauth' || payload.type !== expectedType) {
        throw new UnauthorizedException('Некорректный OAuth state');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('Некорректный или просроченный OAuth state');
    }
  }

  private async exchangeCode(
    type: CrmProviderType,
    code: string,
    referer?: string,
  ): Promise<CrmOAuthTokens> {
    const fetchFn = this.config.get<typeof fetch>('CRM_HTTP_FETCH') ?? fetch;
    const clientId = this.getClientId(type)!;
    const clientSecret = this.getClientSecret(type)!;
    const redirectUri = this.getRedirectUri(type);

    if (type === 'amocrm') {
      const domain = this.extractDomain(referer);
      const response = await fetchFn(`https://${domain}/oauth2/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
        }),
      });
      if (!response.ok) {
        throw new BadRequestException('Не удалось обменять код amoCRM');
      }
      const data = (await response.json()) as {
        access_token: string;
        refresh_token: string;
        expires_in: number;
      };
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + data.expires_in * 1000,
        accountDomain: domain,
      };
    }

    const response = await fetchFn('https://oauth.bitrix.info/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });
    if (!response.ok) {
      throw new BadRequestException('Не удалось обменять код Bitrix24');
    }
    const data = (await response.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      client_endpoint?: string;
    };
    const portalDomain = data.client_endpoint
      ? new URL(data.client_endpoint).host
      : this.extractDomain(referer);
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
      portalDomain,
    };
  }

  private getClientId(type: CrmProviderType) {
    return type === 'amocrm'
      ? this.config.get<string>('AMOCRM_CLIENT_ID')
      : this.config.get<string>('BITRIX24_CLIENT_ID');
  }

  private getClientSecret(type: CrmProviderType) {
    return type === 'amocrm'
      ? this.config.get<string>('AMOCRM_CLIENT_SECRET')
      : this.config.get<string>('BITRIX24_CLIENT_SECRET');
  }

  private getRedirectUri(type: CrmProviderType) {
    const apiBase = this.config.get<string>(
      'API_PUBLIC_URL',
      'http://localhost:3000/api',
    );
    return type === 'amocrm'
      ? this.config.get<string>(
          'AMOCRM_REDIRECT_URI',
          `${apiBase}/integrations/amocrm/callback`,
        )
      : this.config.get<string>(
          'BITRIX24_REDIRECT_URI',
          `${apiBase}/integrations/bitrix24/callback`,
        );
  }

  private extractDomain(referer?: string) {
    if (!referer) {
      throw new BadRequestException('Не передан referer аккаунта CRM');
    }
    return new URL(referer.startsWith('http') ? referer : `https://${referer}`)
      .host;
  }
}
