import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { SourcesService } from '../sources/sources.service';
import { AiOrchestratorService } from '../ai/services/ai-orchestrator.service';
import { WidgetRateLimitService } from '../ai/services/widget-rate-limit.service';
import { DialogService } from '../ai/services/dialog.service';
import type { Source } from '@prisma/client';
import {
  DEFAULT_SOURCE_CONFIG,
  type SourceConfig,
} from '@ai-consultant/shared-types';
import type { DialogAttributionInput } from '../integrations/attribution.util';
import { WIDGET_MAX_MESSAGE_LENGTH } from '../ai/constants';

interface WidgetAttributionPayload {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  referrer?: string;
  landingPage?: string;
  yandexClientId?: string;
  gaClientId?: string;
}

interface WidgetJoinPayload {
  widgetKey: string;
  dialogId?: string;
  visitorId: string;
  attribution?: WidgetAttributionPayload;
}

interface WidgetMessagePayload {
  widgetKey: string;
  dialogId?: string;
  visitorId: string;
  content: string;
  attribution?: WidgetAttributionPayload;
}

function normalizeAttribution(
  payload?: WidgetAttributionPayload,
): DialogAttributionInput | undefined {
  if (!payload) return undefined;
  const attribution: DialogAttributionInput = {};
  if (payload.utmSource) attribution.utmSource = payload.utmSource;
  if (payload.utmMedium) attribution.utmMedium = payload.utmMedium;
  if (payload.utmCampaign) attribution.utmCampaign = payload.utmCampaign;
  if (payload.utmContent) attribution.utmContent = payload.utmContent;
  if (payload.utmTerm) attribution.utmTerm = payload.utmTerm;
  if (payload.referrer) attribution.referrer = payload.referrer;
  if (payload.landingPage) attribution.landingPage = payload.landingPage;
  if (payload.yandexClientId) attribution.yandexClientId = payload.yandexClientId;
  if (payload.gaClientId) attribution.gaClientId = payload.gaClientId;
  return Object.keys(attribution).length ? attribution : undefined;
}

@WebSocketGateway({
  namespace: '/widget',
  cors: { origin: '*' },
})
export class ChatGateway implements OnGatewayConnection {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly sourcesService: SourcesService,
    private readonly orchestrator: AiOrchestratorService,
    private readonly rateLimit: WidgetRateLimitService,
    private readonly dialogService: DialogService,
  ) {}

  private isOriginAllowed(client: Socket, source: Source): boolean {
    const allowed = this.sourcesService.getAllowedOrigins(source);
    if (!allowed.length) return true;
    const origin = client.handshake.headers.origin ?? client.handshake.headers.referer;
    if (!origin) return false;
    return allowed.some((o) => origin === o || origin.startsWith(`${o}/`));
  }

  handleConnection(client: Socket) {
    client.emit('connected', { ok: true });
  }

  @SubscribeMessage('join')
  async handleJoin(
    @MessageBody() data: WidgetJoinPayload,
    @ConnectedSocket() client: Socket,
  ) {
    if (!data?.widgetKey || !data?.visitorId) return;

    const source = await this.sourcesService.findByWidgetKey(data.widgetKey);
    if (!source || source.status !== 'active') {
      client.emit('error', { code: 'invalid_widget' });
      return;
    }

    if (!this.isOriginAllowed(client, source)) {
      client.emit('error', { code: 'origin_not_allowed' });
      client.disconnect(true);
      return;
    }

    client.data.widgetKey = data.widgetKey;
    client.data.visitorId = data.visitorId;
    client.data.attribution = normalizeAttribution(data.attribution);
    client.join(`visitor:${data.visitorId}`);

    if (data.dialogId) {
      try {
        if (client.data.attribution) {
          await this.dialogService.getOrCreateDialog(
            source.tenantId,
            source.id,
            data.visitorId,
            data.dialogId,
            client.data.attribution,
          );
        }
        const history = await this.dialogService.getPublicHistory(
          data.dialogId,
          data.widgetKey,
          data.visitorId,
        );
        client.emit('history', history);
        client.join(`dialog:${history.dialogId}`);
      } catch {
        const resumed = await this.dialogService.findResumableDialog(
          source.tenantId,
          source.id,
          data.visitorId,
        );
        if (resumed) {
          const history = await this.dialogService.getPublicHistory(
            resumed.id,
            data.widgetKey,
            data.visitorId,
          );
          client.emit('history', history);
          client.join(`dialog:${history.dialogId}`);
        } else {
          client.emit('error', { code: 'dialog_not_found' });
        }
      }
    } else {
      const resumed = await this.dialogService.findResumableDialog(
        source.tenantId,
        source.id,
        data.visitorId,
      );
      if (resumed) {
        try {
          const history = await this.dialogService.getPublicHistory(
            resumed.id,
            data.widgetKey,
            data.visitorId,
          );
          client.emit('history', history);
          client.join(`dialog:${history.dialogId}`);
        } catch {
          /* no history */
        }
      }
    }

    client.emit('joined', {
      visitorId: data.visitorId,
      dialogId: data.dialogId,
    });
  }

  private clientIp(client: Socket): string {
    const forwarded = client.handshake.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0].trim();
    }
    return client.handshake.address ?? 'unknown';
  }

  @SubscribeMessage('message')
  async handleMessage(
    @MessageBody() data: WidgetMessagePayload,
    @ConnectedSocket() client: Socket,
  ) {
    if (!data?.widgetKey || !data?.visitorId || !data?.content?.trim()) {
      return;
    }

    const content = data.content.trim();
    if (content.length > WIDGET_MAX_MESSAGE_LENGTH) {
      client.emit('rate_limited', {
        message: `Сообщение слишком длинное (макс. ${WIDGET_MAX_MESSAGE_LENGTH} символов).`,
      });
      return;
    }

    const source = await this.sourcesService.findByWidgetKey(data.widgetKey);
    if (!source || source.status !== 'active') {
      client.emit('error', { code: 'invalid_widget' });
      return;
    }

    const config =
      (source.configJson as unknown as SourceConfig) ?? DEFAULT_SOURCE_CONFIG;

    const duplicateOk = await this.rateLimit.checkDuplicate(
      data.visitorId,
      content,
    );
    if (!duplicateOk) {
      client.emit('rate_limited', {
        message: 'Пожалуйста, не отправляйте одинаковые сообщения подряд.',
      });
      return;
    }

    const ip = this.clientIp(client);
    const limit = await this.rateLimit.checkLimit(data.visitorId, ip, {
      visitorMax: config.security?.rateLimitPerMinute,
      ipMax: config.security?.ipRateLimitPerMinute,
    });
    if (!limit.allowed) {
      client.emit('rate_limited', {
        message:
          limit.reason === 'ip'
            ? 'Слишком много запросов с вашего IP. Подождите немного.'
            : 'Слишком много сообщений. Подождите немного.',
      });
      return;
    }

    if (!this.isOriginAllowed(client, source)) {
      client.emit('error', { code: 'origin_not_allowed' });
      client.disconnect(true);
      return;
    }

    const attribution =
      normalizeAttribution(data.attribution) ?? client.data.attribution;

    try {
      const stream = this.orchestrator.streamResponse({
        tenantId: source.tenantId,
        sourceId: source.id,
        visitorId: data.visitorId,
        dialogId: data.dialogId,
        content,
        sourceConfig: config,
        attribution,
      });

      let activeDialogId = data.dialogId;
      let messageId: string | undefined;
      let streamStarted = false;

      for await (const chunk of stream) {
        if (chunk.type === 'dialog' && chunk.dialogId) {
          activeDialogId = chunk.dialogId;
          client.join(`dialog:${chunk.dialogId}`);
          client.emit('dialog:created', { dialogId: chunk.dialogId });
          if (!streamStarted) {
            client.emit('stream:start', { dialogId: chunk.dialogId });
            streamStarted = true;
          }
        }

        if (chunk.type === 'token' && chunk.token) {
          if (!streamStarted) {
            client.emit('stream:start', { dialogId: activeDialogId });
            streamStarted = true;
          }
          client.emit('stream:token', {
            dialogId: activeDialogId,
            token: chunk.token,
          });
        }

        if (chunk.type === 'done') {
          messageId = chunk.messageId;
          client.emit('stream:end', {
            dialogId: activeDialogId,
            messageId: chunk.messageId,
            content: chunk.content,
            provider: chunk.provider,
          });
        }

        if (chunk.type === 'error') {
          const code = chunk.code;
          if (code === 'TRIAL_EXPIRED') {
            client.emit('trial_expired', {
              message: chunk.error,
            });
          } else if (code === 'USAGE_LIMIT_EXCEEDED') {
            client.emit('limit_exceeded', {
              message: chunk.error,
            });
          } else if (code === 'TENANT_SUSPENDED') {
            client.emit('tenant_suspended', {
              message: chunk.error,
            });
          }
          client.emit('stream:error', {
            dialogId: activeDialogId,
            error: chunk.error,
            code,
          });
        }
      }
    } catch (error) {
      this.logger.error(`Widget message failed: ${String(error)}`);
      client.emit('stream:error', {
        error: 'Произошла ошибка при обработке сообщения',
      });
    }
  }

  @SubscribeMessage('dialog:close')
  async handleDialogClose(
    @MessageBody()
    data: { widgetKey: string; dialogId: string; visitorId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data?.widgetKey || !data?.dialogId || !data?.visitorId) return;

    const source = await this.sourcesService.findByWidgetKey(data.widgetKey);
    if (!source || source.status !== 'active') {
      client.emit('error', { code: 'invalid_widget' });
      return;
    }

    if (!this.isOriginAllowed(client, source)) {
      client.emit('error', { code: 'origin_not_allowed' });
      client.disconnect(true);
      return;
    }

    try {
      await this.dialogService.closeDialog(
        data.dialogId,
        source.tenantId,
        data.visitorId,
        source.id,
      );
      client.emit('dialog:closed', { dialogId: data.dialogId });
    } catch {
      client.emit('error', { code: 'dialog_not_found' });
    }
  }
}
