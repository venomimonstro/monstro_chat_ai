import { Injectable, Logger } from '@nestjs/common';
import type { SourceConfig } from '@ai-consultant/shared-types';
import { DEFAULT_SOURCE_CONFIG } from '@ai-consultant/shared-types';
import type { Source } from '@prisma/client';
import { AiOrchestratorService } from '../ai/services/ai-orchestrator.service';
import { ChannelRegistryService } from './channel-adapters';
import type { UnifiedInboundMessage } from './channel.types';

@Injectable()
export class ChannelMessageService {
  private readonly logger = new Logger(ChannelMessageService.name);

  constructor(
    private readonly registry: ChannelRegistryService,
    private readonly orchestrator: AiOrchestratorService,
  ) {}

  async handleInbound(source: Source, payload: unknown) {
    const adapter = this.registry.getAdapter(source.type);
    if (!adapter) return;

    const inbound = adapter.parseInbound(payload, source);
    if (!inbound) return;

    const config =
      (source.configJson as unknown as SourceConfig) ?? DEFAULT_SOURCE_CONFIG;

    try {
      const result = await this.orchestrator.processMessage({
        tenantId: inbound.tenantId,
        sourceId: inbound.sourceId,
        visitorId: inbound.visitorId,
        content: inbound.content,
        sourceConfig: config,
      });

      await adapter.sendReply(
        { content: result.content, replyMeta: inbound.replyMeta },
        { ...inbound, dialogId: result.dialogId },
        source,
      );
    } catch (error) {
      this.logger.error(`Channel message failed: ${String(error)}`);
      await adapter.sendReply(
        {
          content: 'Извините, сейчас не могу ответить. Попробуйте позже.',
          replyMeta: inbound.replyMeta,
        },
        inbound,
        source,
      );
    }
  }
}
