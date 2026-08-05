import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ChatFunnelEventType, Prisma } from '@prisma/client';
import type {
  ChatFunnelDto,
  ChatFunnelEventType as SharedEventType,
} from '@ai-consultant/shared-types';
import { PrismaService } from '../../../prisma/prisma.service';
import { AnalyticsCacheService } from './analytics-cache.service';
import {
  attributionToUtmJson,
  type DialogAttributionInput,
} from '../../integrations/attribution.util';

const STAGE_META: Array<{ key: SharedEventType; label: string }> = [
  { key: 'widget_open', label: 'Открытие чата' },
  { key: 'first_message', label: 'Первое сообщение' },
  { key: 'contact_shared', label: 'Контакт оставлен' },
  { key: 'lead_created', label: 'Лид создан' },
];

interface EventContext {
  tenantId: string;
  sourceId: string;
  visitorId: string;
  dialogId?: string;
  attribution?: DialogAttributionInput;
}

@Injectable()
export class ChatFunnelService {
  private readonly logger = new Logger(ChatFunnelService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: AnalyticsCacheService,
  ) {}

  async trackWidgetOpen(params: {
    widgetKey: string;
    visitorId: string;
    attribution?: DialogAttributionInput;
  }) {
    const source = await this.prisma.source.findUnique({
      where: { widgetKey: params.widgetKey },
    });
    if (!source || source.status !== 'active') {
      throw new NotFoundException('Виджет не найден');
    }

    const since = new Date(Date.now() - 60 * 60 * 1000);
    const recent = await this.prisma.chatFunnelEvent.findFirst({
      where: {
        sourceId: source.id,
        visitorId: params.visitorId,
        eventType: 'widget_open',
        createdAt: { gte: since },
      },
      select: { id: true },
    });
    if (recent) return { recorded: false };

    await this.record('widget_open', {
      tenantId: source.tenantId,
      sourceId: source.id,
      visitorId: params.visitorId,
      attribution: params.attribution,
    });
    return { recorded: true };
  }

  async trackFirstMessage(params: {
    tenantId: string;
    sourceId: string;
    dialogId: string;
    visitorId: string;
  }) {
    await this.record('first_message', params);
  }

  async trackContactShared(params: {
    tenantId: string;
    sourceId: string;
    dialogId: string;
    visitorId: string;
  }) {
    await this.record('contact_shared', params);
  }

  async trackLeadCreated(params: {
    tenantId: string;
    sourceId: string;
    dialogId: string;
    visitorId: string;
  }) {
    await this.record('lead_created', params);
  }

  async getChatFunnel(
    tenantId: string,
    from: Date,
    to: Date,
    sourceId?: string,
  ): Promise<ChatFunnelDto> {
    const sourceFilter = sourceId
      ? Prisma.sql`AND e.source_id = ${sourceId}::uuid`
      : Prisma.empty;

    const counts = await this.prisma.$queryRaw<
      Array<{ event_type: ChatFunnelEventType; count: bigint }>
    >`
      SELECT e.event_type,
             CASE
               WHEN e.event_type = 'widget_open'
                 THEN COUNT(DISTINCT e.visitor_id)
               ELSE COUNT(DISTINCT e.dialog_id)
             END::bigint AS count
      FROM chat_funnel_events e
      WHERE e.tenant_id = ${tenantId}::uuid
        AND e.created_at >= ${from}
        AND e.created_at <= ${to}
        ${sourceFilter}
      GROUP BY e.event_type
    `;

    const countMap = new Map<ChatFunnelEventType, number>();
    for (const row of counts) {
      countMap.set(row.event_type, Number(row.count));
    }

    const stageCounts = STAGE_META.map((stage) =>
      countMap.get(stage.key as ChatFunnelEventType) ?? 0,
    );
    const topCount = stageCounts[0] || 1;

    const stages = STAGE_META.map((stage, index) => {
      const count = stageCounts[index] ?? 0;
      const prev = index > 0 ? (stageCounts[index - 1] ?? 0) : null;
      return {
        key: stage.key,
        label: stage.label,
        count,
        rateFromTop: topCount > 0 ? Math.round((count / topCount) * 1000) / 10 : 0,
        dropOffFromPrevious:
          prev && prev > 0
            ? Math.round(((prev - count) / prev) * 1000) / 10
            : null,
      };
    });

    const [byUtmSource, byLandingPage] = await Promise.all([
      this.breakdownByUtm(tenantId, from, to, sourceId),
      this.breakdownByLandingPage(tenantId, from, to, sourceId),
    ]);

    return { stages, byUtmSource, byLandingPage };
  }

  private async breakdownByUtm(
    tenantId: string,
    from: Date,
    to: Date,
    sourceId?: string,
  ) {
    const sourceFilter = sourceId
      ? Prisma.sql`AND e.source_id = ${sourceId}::uuid`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<
      Array<{
        label: string;
        widget_open: bigint;
        first_message: bigint;
        contact_shared: bigint;
        lead_created: bigint;
      }>
    >`
      SELECT COALESCE(NULLIF(e.utm_json->>'utm_source', ''), '(direct)') AS label,
             COUNT(DISTINCT CASE WHEN e.event_type = 'widget_open' THEN e.visitor_id END)::bigint AS widget_open,
             COUNT(DISTINCT CASE WHEN e.event_type = 'first_message' THEN e.dialog_id END)::bigint AS first_message,
             COUNT(DISTINCT CASE WHEN e.event_type = 'contact_shared' THEN e.dialog_id END)::bigint AS contact_shared,
             COUNT(DISTINCT CASE WHEN e.event_type = 'lead_created' THEN e.dialog_id END)::bigint AS lead_created
      FROM chat_funnel_events e
      WHERE e.tenant_id = ${tenantId}::uuid
        AND e.created_at >= ${from}
        AND e.created_at <= ${to}
        ${sourceFilter}
      GROUP BY 1
      ORDER BY widget_open DESC
      LIMIT 10
    `;

    return rows.map((row) => ({
      label: row.label,
      widgetOpen: Number(row.widget_open),
      firstMessage: Number(row.first_message),
      contactShared: Number(row.contact_shared),
      leadCreated: Number(row.lead_created),
    }));
  }

  private async breakdownByLandingPage(
    tenantId: string,
    from: Date,
    to: Date,
    sourceId?: string,
  ) {
    const sourceFilter = sourceId
      ? Prisma.sql`AND e.source_id = ${sourceId}::uuid`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<
      Array<{
        label: string;
        widget_open: bigint;
        first_message: bigint;
        contact_shared: bigint;
        lead_created: bigint;
      }>
    >`
      SELECT COALESCE(NULLIF(e.landing_page, ''), '(unknown)') AS label,
             COUNT(DISTINCT CASE WHEN e.event_type = 'widget_open' THEN e.visitor_id END)::bigint AS widget_open,
             COUNT(DISTINCT CASE WHEN e.event_type = 'first_message' THEN e.dialog_id END)::bigint AS first_message,
             COUNT(DISTINCT CASE WHEN e.event_type = 'contact_shared' THEN e.dialog_id END)::bigint AS contact_shared,
             COUNT(DISTINCT CASE WHEN e.event_type = 'lead_created' THEN e.dialog_id END)::bigint AS lead_created
      FROM chat_funnel_events e
      WHERE e.tenant_id = ${tenantId}::uuid
        AND e.created_at >= ${from}
        AND e.created_at <= ${to}
        ${sourceFilter}
      GROUP BY 1
      ORDER BY widget_open DESC
      LIMIT 10
    `;

    return rows.map((row) => ({
      label: row.label,
      widgetOpen: Number(row.widget_open),
      firstMessage: Number(row.first_message),
      contactShared: Number(row.contact_shared),
      leadCreated: Number(row.lead_created),
    }));
  }

  private async record(
    eventType: ChatFunnelEventType,
    ctx: EventContext,
  ) {
    try {
      let utmJson = attributionToUtmJson(ctx.attribution);
      let referrer = ctx.attribution?.referrer ?? null;
      let landingPage = ctx.attribution?.landingPage ?? null;

      if (ctx.dialogId) {
        const dialog = await this.prisma.dialog.findFirst({
          where: { id: ctx.dialogId, tenantId: ctx.tenantId },
          select: { utmJson: true, referrer: true, landingPage: true },
        });
        if (dialog) {
          utmJson = { ...(dialog.utmJson as Record<string, string>), ...utmJson };
          referrer = referrer ?? dialog.referrer;
          landingPage = landingPage ?? dialog.landingPage;
        }
      }

      if (ctx.dialogId) {
        await this.prisma.chatFunnelEvent.createMany({
          data: [
            {
              tenantId: ctx.tenantId,
              sourceId: ctx.sourceId,
              dialogId: ctx.dialogId,
              visitorId: ctx.visitorId,
              eventType,
              utmJson,
              referrer,
              landingPage,
            },
          ],
          skipDuplicates: true,
        });
      } else {
        await this.prisma.chatFunnelEvent.create({
          data: {
            tenantId: ctx.tenantId,
            sourceId: ctx.sourceId,
            visitorId: ctx.visitorId,
            eventType,
            utmJson,
            referrer,
            landingPage,
          },
        });
      }

      void this.cache.invalidateTenant(ctx.tenantId);
    } catch (error) {
      this.logger.warn(`Chat funnel event ${eventType} skipped: ${String(error)}`);
    }
  }
}
