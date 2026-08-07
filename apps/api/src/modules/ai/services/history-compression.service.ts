import { Injectable, Logger } from '@nestjs/common';
import { DialogService } from './dialog.service';
import { ProviderRegistryService } from '../providers/provider-registry.service';
import {
  HISTORY_SUMMARY_THRESHOLD,
  KEEP_RECENT_MESSAGES,
} from '../constants';
import type { ChatMessage } from '../providers/llm-provider.interface';

@Injectable()
export class HistoryCompressionService {
  private readonly logger = new Logger(HistoryCompressionService.name);

  constructor(
    private readonly dialogService: DialogService,
    private readonly providers: ProviderRegistryService,
  ) {}

  async compressIfNeeded(dialogId: string, tenantId: string): Promise<void> {
    const messages = await this.dialogService.getMessages(dialogId, tenantId);
    if (messages.length < HISTORY_SUMMARY_THRESHOLD) return;

    const toSummarize = messages.slice(0, -KEEP_RECENT_MESSAGES);
    if (!toSummarize.length) return;

    const transcript = toSummarize
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    const summaryPrompt: ChatMessage[] = [
      {
        role: 'system',
        content:
          'Сожми диалог в краткое резюме на русском (до 500 символов), сохрани ключевые факты и вопросы пользователя.',
      },
      { role: 'user', content: transcript },
    ];

    let summary = '';
    const chain = this.providers.getAvailableProviders();

    for (const provider of chain) {
      try {
        for await (const token of provider.streamChat(summaryPrompt, {
          maxTokens: 300,
        })) {
          summary += token.content;
          if (token.done) break;
        }
        break;
      } catch (error) {
        this.logger.warn(
          `Summary via ${provider.name} failed: ${String(error)}`,
        );
      }
    }

    if (!summary.trim()) {
      summary = transcript.slice(0, 500);
    }

    await this.dialogService.updateSummary(dialogId, tenantId, summary.trim());
    await this.dialogService.deleteMessages(
      toSummarize.map((m) => m.id),
      tenantId,
    );
  }
}
