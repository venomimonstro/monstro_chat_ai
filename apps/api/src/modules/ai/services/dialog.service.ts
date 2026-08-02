import { Injectable, NotFoundException } from '@nestjs/common';
import { MessageRole } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { OutgoingWebhookService } from '../../integrations/outgoing-webhook/outgoing-webhook.service';
import {
  attributionToUtmJson,
  type DialogAttributionInput,
} from '../../integrations/attribution.util';
import { AnalyticsCacheService } from '../../analytics/services/analytics-cache.service';

@Injectable()
export class DialogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outgoingWebhook: OutgoingWebhookService,
    private readonly analyticsCache: AnalyticsCacheService,
  ) {}

  async getOrCreateDialog(
    tenantId: string,
    sourceId: string,
    visitorId: string,
    dialogId?: string,
    attribution?: DialogAttributionInput,
  ) {
    if (dialogId) {
      const existing = await this.prisma.dialog.findFirst({
        where: { id: dialogId, tenantId, visitorId, sourceId },
      });
      if (!existing) throw new NotFoundException('Диалог не найден');
      if (attribution) {
        await this.applyAttributionIfEmpty(existing.id, attribution);
        return this.prisma.dialog.findUniqueOrThrow({ where: { id: existing.id } });
      }
      return existing;
    }

    const dialog = await this.prisma.dialog.create({
      data: {
        tenantId,
        sourceId,
        visitorId,
        utmJson: attributionToUtmJson(attribution),
        referrer: attribution?.referrer,
        landingPage: attribution?.landingPage,
        yandexClientId: attribution?.yandexClientId,
        gaClientId: attribution?.gaClientId,
      },
    });
    void this.analyticsCache.invalidateTenant(tenantId);
    return dialog;
  }

  private async applyAttributionIfEmpty(
    dialogId: string,
    attribution: DialogAttributionInput,
  ) {
    const dialog = await this.prisma.dialog.findUnique({ where: { id: dialogId } });
    if (!dialog) return;

    const utm = (dialog.utmJson ?? {}) as Record<string, string>;
    const nextUtm = { ...utm, ...attributionToUtmJson(attribution) };

    await this.prisma.dialog.update({
      where: { id: dialogId },
      data: {
        utmJson: nextUtm,
        referrer: dialog.referrer ?? attribution.referrer,
        landingPage: dialog.landingPage ?? attribution.landingPage,
        yandexClientId: dialog.yandexClientId ?? attribution.yandexClientId,
        gaClientId: dialog.gaClientId ?? attribution.gaClientId,
      },
    });
  }

  async getMessages(dialogId: string, tenantId: string) {
    return this.prisma.message.findMany({
      where: { dialogId, tenantId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addMessage(params: {
    dialogId: string;
    tenantId: string;
    role: MessageRole;
    content: string;
    tokenCount?: number;
    provider?: string;
    model?: string;
  }) {
    return this.prisma.message.create({
      data: {
        dialogId: params.dialogId,
        tenantId: params.tenantId,
        role: params.role,
        content: params.content,
        tokenCount: params.tokenCount,
        provider: params.provider,
        model: params.model,
      },
    });
  }

  async updateSummary(dialogId: string, summary: string) {
    return this.prisma.dialog.update({
      where: { id: dialogId },
      data: { summary },
    });
  }

  async deleteMessages(ids: string[]) {
    if (!ids.length) return;
    await this.prisma.message.deleteMany({ where: { id: { in: ids } } });
  }

  async closeDialog(
    dialogId: string,
    tenantId: string,
    visitorId: string,
    sourceId: string,
  ) {
    const dialog = await this.prisma.dialog.findFirst({
      where: { id: dialogId, tenantId, visitorId, sourceId },
    });
    if (!dialog) throw new NotFoundException('Диалог не найден');
    if (dialog.status === 'closed') return dialog;

    const updated = await this.prisma.dialog.update({
      where: { id: dialogId },
      data: { status: 'closed', endedAt: new Date() },
    });

    void this.outgoingWebhook.deliver(tenantId, 'dialog.closed', {
      dialogId: updated.id,
      sourceId: updated.sourceId,
      visitorId: updated.visitorId,
      endedAt: updated.endedAt?.toISOString() ?? null,
    });

    return updated;
  }

  async getPublicHistory(
    dialogId: string,
    widgetKey: string,
    visitorId: string,
  ) {
    const source = await this.prisma.source.findUnique({
      where: { widgetKey },
    });
    if (!source) throw new NotFoundException();

    const dialog = await this.prisma.dialog.findFirst({
      where: {
        id: dialogId,
        tenantId: source.tenantId,
        sourceId: source.id,
        visitorId,
      },
    });
    if (!dialog) throw new NotFoundException();

    const messages = await this.getMessages(dialogId, source.tenantId);
    return {
      dialogId: dialog.id,
      messages: messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.content, id: m.id })),
    };
  }
}
