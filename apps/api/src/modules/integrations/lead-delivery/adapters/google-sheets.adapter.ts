import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  ILeadDeliveryAdapter,
  LeadDeliveryContext,
  LeadDeliveryValidationResult,
} from '../lead-delivery.types';
import { formatLeadFields } from '../lead-delivery.types';
import { GoogleSheetsOAuthService } from '../google-sheets-oauth.service';

interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  mock?: boolean;
}

@Injectable()
export class GoogleSheetsDeliveryAdapter implements ILeadDeliveryAdapter {
  readonly type = 'google_sheets' as const;
  private readonly logger = new Logger(GoogleSheetsDeliveryAdapter.name);

  constructor(
    private readonly config: ConfigService,
    private readonly googleOAuth: GoogleSheetsOAuthService,
  ) {}

  async validate(
    credentials: Record<string, unknown>,
    config: Record<string, unknown>,
  ): Promise<LeadDeliveryValidationResult> {
    const spreadsheetId = String(config.spreadsheetId ?? '');
    if (!spreadsheetId) {
      return { ok: false, error: 'Укажите ID таблицы Google Sheets' };
    }
    if (!credentials.accessToken && !credentials.refreshToken) {
      return { ok: false, error: 'Подключите Google аккаунт через OAuth' };
    }
    return { ok: true };
  }

  async deliver(ctx: LeadDeliveryContext): Promise<void> {
    const spreadsheetId = String(ctx.config.spreadsheetId ?? '');
    const sheetName = String(ctx.config.sheetName ?? 'Лиды');
    if (!spreadsheetId) {
      throw new Error('Google Sheets: не задан spreadsheetId');
    }

    const tokens = ctx.credentials as unknown as GoogleTokens;
    if (!tokens.accessToken && !tokens.refreshToken && !tokens.mock) {
      throw new Error('Google Sheets: не подключён OAuth');
    }

    const fields = formatLeadFields(ctx.lead);
    const row = [
      fields.firstName,
      fields.lastName,
      fields.phone,
      fields.email,
      fields.createdAt,
      fields.source,
      fields.utm,
    ];

    if (tokens.mock) {
      this.logger.log(
        `[MOCK] Google Sheets append to ${spreadsheetId}/${sheetName}: ${row.join(', ')}`,
      );
      return;
    }

    const accessToken = await this.googleOAuth.ensureAccessToken(tokens);
    const range = encodeURIComponent(`${sheetName}!A:G`);
    const fetchFn = this.config.get<typeof fetch>('CRM_HTTP_FETCH') ?? fetch;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    const response = await fetchFn(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [row] }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Google Sheets API: ${response.status} ${body.slice(0, 200)}`);
    }

    this.logger.log(`Google Sheets row appended for lead ${ctx.lead.id}`);
  }
}
