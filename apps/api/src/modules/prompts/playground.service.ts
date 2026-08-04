import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { RetrievalService } from '../ai/services/retrieval.service';
import { ProviderRegistryService } from '../ai/providers/provider-registry.service';
import { PromptAssemblyService } from '../ai/services/prompt-assembly.service';
import { AntiInjectionService } from '../ai/services/anti-injection.service';
import type { ChatMessage } from '../ai/providers/llm-provider.interface';
import {
  mergeSourceConfig,
  type SourceConfig,
} from '@ai-consultant/shared-types';

@Injectable()
export class PlaygroundService {
  private readonly dailyLimit: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly retrieval: RetrievalService,
    private readonly assembly: PromptAssemblyService,
    private readonly antiInjection: AntiInjectionService,
    private readonly providers: ProviderRegistryService,
    config: ConfigService,
  ) {
    this.dailyLimit = config.get<number>('PLAYGROUND_DAILY_LIMIT', 100);
  }

  async test(params: {
    tenantId: string;
    sourceId: string;
    message: string;
    clientPrompt: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  }) {
    await this.assertQuota(params.tenantId);

    const source = await this.prisma.source.findFirst({
      where: { id: params.sourceId, tenantId: params.tenantId },
    });
    if (!source) throw new NotFoundException('Источник не найден');

    const { isSuspicious, instruction } = this.antiInjection.classify(
      params.message,
    );

    const chunks = await this.retrieval.searchSimilar(
      params.tenantId,
      params.sourceId,
      params.message,
    );

    const contextBlock =
      chunks.length > 0
        ? chunks.map((c, i) => `[${i + 1}] ${c.content}`).join('\n\n')
        : 'Контекст не найден.';

    const assembled = await this.assembly.assemble({
      tenantId: params.tenantId,
      ragContext: contextBlock,
      fallbackClientPrompt: params.clientPrompt,
      antiInjectionInstruction: instruction,
      personaConfig: mergeSourceConfig(
        source.configJson as unknown as SourceConfig,
      ).ai,
    });

    const historyMessages: ChatMessage[] = (params.history ?? []).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const messages: ChatMessage[] = [
      { role: 'system', content: assembled.systemContent },
      ...historyMessages,
      { role: 'user', content: params.message },
    ];

    const chain = this.providers.getChain();
    let fullResponse = '';
    let usedProvider = chain[chain.length - 1];
    let usedModel = usedProvider.defaultModel;

    for (const provider of chain) {
      try {
        usedProvider = provider;
        usedModel = provider.defaultModel;
        fullResponse = '';
        for await (const token of provider.streamChat(messages)) {
          fullResponse += token.content;
          if (token.done) break;
        }
        break;
      } catch {
        fullResponse = '';
      }
    }

    if (!fullResponse) {
      fullResponse =
        'Не удалось сгенерировать ответ. Проверьте настройки провайдера LLM.';
    }

    return {
      content: fullResponse,
      provider: usedProvider.name,
      model: usedModel,
      isSuspicious,
    };
  }

  private async assertQuota(tenantId: string) {
    const client = this.redis.getClient();
    if (!client) return;

    const key = `playground:${tenantId}:${new Date().toISOString().slice(0, 10)}`;
    const count = await client.incr(key);
    if (count === 1) {
      await client.expire(key, 86400);
    }
    if (count > this.dailyLimit) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'PLAYGROUND_LIMIT_EXCEEDED',
        message: 'Дневной лимит playground исчерпан',
      });
    }
  }
}
