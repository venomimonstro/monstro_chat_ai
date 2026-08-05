import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
  private readonly resumeDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly outgoingWebhook: OutgoingWebhookService,
    private readonly analyticsCache: AnalyticsCacheService,
    config: ConfigService,
  ) {
    this.resumeDays = config.get<number>('DIALOG_RESUME_DAYS', 30);
  }

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

  async getMessages(
    dialogId: string,
    tenantId: string,
    limit = 50,
  ) {
    const messages = await this.prisma.message.findMany({
      where: { dialogId, tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return messages.reverse();
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

  async resolveEffectiveDialogId(
    tenantId: string,
    dialogId: string,
  ): Promise<string> {
    const marker = await this.prisma.message.findFirst({
      where: {
        dialogId,
        tenantId,
        role: 'system',
        content: { startsWith: '__DEDUP_LINK__:' },
      },
      orderBy: { createdAt: 'desc' },
      select: { content: true },
    });
    if (!marker) return dialogId;
    const targetDialogId = marker.content.split(':')[1];
    return targetDialogId || dialogId;
  }

  private async resolveEffectiveDialogIds(
    tenantId: string,
    dialogIds: string[],
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    for (const id of dialogIds) map.set(id, id);
    if (!dialogIds.length) return map;

    const markers = await this.prisma.message.findMany({
      where: {
        dialogId: { in: dialogIds },
        tenantId,
        role: 'system',
        content: { startsWith: '__DEDUP_LINK__:' },
      },
      orderBy: { createdAt: 'desc' },
      select: { dialogId: true, content: true },
    });

    for (const marker of markers) {
      const targetDialogId = marker.content.split(':')[1];
      if (targetDialogId) map.set(marker.dialogId, targetDialogId);
    }
    return map;
  }

  /** Resume last conversation for a returning visitor (Sprint 61). */
  async findResumableDialog(
    tenantId: string,
    sourceId: string,
    visitorId: string,
    preferredDialogId?: string,
  ) {
    if (preferredDialogId) {
      const preferred = await this.prisma.dialog.findFirst({
        where: {
          id: preferredDialogId,
          tenantId,
          sourceId,
          visitorId,
        },
      });
      if (preferred) {
        const effectiveId = await this.resolveEffectiveDialogId(
          tenantId,
          preferred.id,
        );
        return this.prisma.dialog.findFirst({
          where: { id: effectiveId, tenantId, sourceId, visitorId },
        });
      }
    }

    const since = new Date();
    since.setDate(since.getDate() - this.resumeDays);

    const recent = await this.prisma.dialog.findMany({
      where: {
        tenantId,
        sourceId,
        visitorId,
        updatedAt: { gte: since },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    });

    const effectiveMap = await this.resolveEffectiveDialogIds(
      tenantId,
      recent.map((d) => d.id),
    );
    if (preferredDialogId) {
      effectiveMap.set(
        preferredDialogId,
        effectiveMap.get(preferredDialogId) ?? preferredDialogId,
      );
    }

    for (const dialog of recent) {
      const effectiveId = effectiveMap.get(dialog.id) ?? dialog.id;
      const effective = await this.prisma.dialog.findFirst({
        where: { id: effectiveId, tenantId, sourceId, visitorId },
      });
      if (effective?.status === 'active') return effective;
    }

    if (recent[0]) {
      const effectiveId = effectiveMap.get(recent[0].id) ?? recent[0].id;
      return (
        (await this.prisma.dialog.findFirst({
          where: { id: effectiveId, tenantId, sourceId, visitorId },
        })) ?? recent[0]
      );
    }

    return null;
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

    let dialog = await this.prisma.dialog.findFirst({
      where: {
        id: dialogId,
        tenantId: source.tenantId,
        sourceId: source.id,
        visitorId,
      },
    });

    if (!dialog) {
      dialog = await this.findResumableDialog(
        source.tenantId,
        source.id,
        visitorId,
        dialogId,
      );
    }
    if (!dialog) throw new NotFoundException();

    const effectiveDialogId = await this.resolveEffectiveDialogId(
      source.tenantId,
      dialog.id,
    );

    const messages = await this.getMessages(effectiveDialogId, source.tenantId);
    return {
      dialogId: effectiveDialogId,
      resumed: effectiveDialogId !== dialogId,
      messages: messages
        .filter(
          (m) =>
            (m.role === 'user' || m.role === 'assistant') &&
            !m.content.startsWith('__DEDUP_LINK__:'),
        )
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
          id: m.id,
          createdAt: m.createdAt.toISOString(),
        })),
    };
  }
}
