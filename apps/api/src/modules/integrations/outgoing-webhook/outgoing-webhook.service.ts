import { Injectable, Logger } from '@nestjs/common';
import { createHmac, randomBytes } from 'crypto';
import type {
  OutgoingWebhookDto,
  OutgoingWebhookEvent,
  SaveOutgoingWebhookDto,
} from '@ai-consultant/shared-types';
import { PrismaService } from '../../../prisma/prisma.service';
import { CredentialCryptoService } from '../services/credential-crypto.service';

@Injectable()
export class OutgoingWebhookService {
  private readonly logger = new Logger(OutgoingWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CredentialCryptoService,
  ) {}

  async getConfig(tenantId: string): Promise<OutgoingWebhookDto> {
    const row = await this.prisma.outgoingWebhook.findUnique({
      where: { tenantId },
    });
    if (!row) {
      return {
        url: '',
        enabled: false,
        events: ['lead.created', 'dialog.closed'],
        hasSecret: false,
      };
    }
    return {
      url: row.url,
      enabled: row.enabled,
      events: (row.eventsJson as OutgoingWebhookEvent[]) ?? [
        'lead.created',
        'dialog.closed',
      ],
      hasSecret: Boolean(row.secretEncrypted),
    };
  }

  async saveConfig(tenantId: string, dto: SaveOutgoingWebhookDto) {
    const secretEncrypted = dto.secret
      ? this.crypto.encrypt(dto.secret)
      : undefined;

    const data = {
      url: dto.url.trim(),
      enabled: dto.enabled ?? true,
      eventsJson: dto.events ?? ['lead.created', 'dialog.closed'],
      ...(secretEncrypted !== undefined ? { secretEncrypted } : {}),
    };

    await this.prisma.outgoingWebhook.upsert({
      where: { tenantId },
      create: { tenantId, ...data },
      update: data,
    });

    return this.getConfig(tenantId);
  }

  async generateSecret(tenantId: string) {
    const secret = randomBytes(24).toString('base64url');
    await this.prisma.outgoingWebhook.upsert({
      where: { tenantId },
      create: {
        tenantId,
        url: '',
        secretEncrypted: this.crypto.encrypt(secret),
        enabled: false,
      },
      update: {
        secretEncrypted: this.crypto.encrypt(secret),
      },
    });
    return { secret };
  }

  async deliver(
    tenantId: string,
    event: OutgoingWebhookEvent,
    payload: Record<string, unknown>,
  ) {
    const config = await this.prisma.outgoingWebhook.findUnique({
      where: { tenantId },
    });
    if (!config?.enabled || !config.url) return;

    const events = (config.eventsJson as string[]) ?? [];
    if (!events.includes(event)) return;

    const body = JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      data: payload,
    });

    const secret = config.secretEncrypted
      ? this.crypto.decrypt(config.secretEncrypted)
      : '';

    const signature = secret
      ? createHmac('sha256', secret).update(body).digest('hex')
      : '';

    const log = await this.prisma.webhookLog.create({
      data: {
        tenantId,
        direction: 'out',
        payloadJson: JSON.parse(body),
        status: 'pending',
      },
    });

    try {
      const response = await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(signature
            ? { 'X-AICW-Signature': `sha256=${signature}` }
            : {}),
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });

      await this.prisma.webhookLog.update({
        where: { id: log.id },
        data: {
          status: response.ok ? 'success' : 'failed',
          errorMessage: response.ok ? null : `HTTP ${response.status}`,
        },
      });
    } catch (error) {
      await this.prisma.webhookLog.update({
        where: { id: log.id },
        data: {
          status: 'failed',
          errorMessage: String(error),
        },
      });
      this.logger.warn(`Outgoing webhook failed for ${tenantId}: ${error}`);
    }
  }
}
