import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { SourceConfig } from '@ai-consultant/shared-types';
import { buildPersonaInstruction } from '@ai-consultant/shared-types';
import { DialogService } from '../../ai/services/dialog.service';
import { PromptAssemblyService } from '../../ai/services/prompt-assembly.service';
import { ProviderRegistryService } from '../../ai/providers/provider-registry.service';
import { ModelRouterService } from '../../ai/services/model-router.service';
import { TariffResolverService } from '../../billing/services/tariff-resolver.service';
import { UsageLimitService } from '../../billing/services/usage-limit.service';
import { LeadExtractionService } from '../services/lead-extraction.service';
import { calculateCostUsd } from '../../ai/constants';
import type { ChatMessage } from '../../ai/providers/llm-provider.interface';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  TrialExpiredException,
  UsageLimitExceededException,
  TenantSuspendedException,
} from '../../billing/billing.errors';

@Injectable()
export class FollowUpOrchestratorService {
  private readonly logger = new Logger(FollowUpOrchestratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dialogService: DialogService,
    private readonly promptAssembly: PromptAssemblyService,
    private readonly providers: ProviderRegistryService,
    private readonly modelRouter: ModelRouterService,
    private readonly tariffResolver: TariffResolverService,
    private readonly usageLimit: UsageLimitService,
    private readonly leadExtraction: LeadExtractionService,
  ) {}

  async generateFollowUp(params: {
    dialogId: string;
    tenantId: string;
    sourceId: string;
    sourceConfig: SourceConfig;
    attemptIndex: number;
  }): Promise<{ messageId: string; content: string } | null> {
    try {
      await this.usageLimit.assertCanSendMessage(params.tenantId);
    } catch (error) {
      if (
        error instanceof TrialExpiredException ||
        error instanceof UsageLimitExceededException ||
        error instanceof TenantSuspendedException
      ) {
        this.logger.warn(`Follow-up skipped for ${params.dialogId}: ${error.message}`);
        return null;
      }
      throw error;
    }

    const dialog = await this.prisma.dialog.findFirst({
      where: {
        id: params.dialogId,
        tenantId: params.tenantId,
        sourceId: params.sourceId,
      },
    });
    if (!dialog) return null;

    const leadState = await this.leadExtraction.getLeadState({
      tenantId: params.tenantId,
      dialogId: params.dialogId,
      sourceConfig: params.sourceConfig,
    });

    const assembled = await this.promptAssembly.assemble({
      tenantId: params.tenantId,
      ragContext: '',
      dialogSummary: dialog.summary,
      fallbackClientPrompt: params.sourceConfig.ai?.clientPrompt,
      personaInstruction: buildPersonaInstruction(params.sourceConfig.ai),
      knowledgeMode: params.sourceConfig.ai?.knowledgeMode ?? 'hybrid',
      ragSufficient: false,
      leadGoalInstruction: leadState.instruction,
    });

    const followUpInstruction = [
      '[Follow-up — посетитель молчит]',
      `Это follow-up №${params.attemptIndex + 1}. Посетитель не ответил на ваше последнее сообщение.`,
      'Напиши короткое сообщение (2–3 предложения):',
      '- мягко верни к теме разговора;',
      '- напомни ценность или ответь на возможное возражение;',
      leadState.missing.length
        ? '- если уместно — запроси контакт через блок ---contact--- / ---end---.'
        : '- поблагодари и предложи следующий шаг.',
      'Не извиняйся за задержку, не упоминай бота/ИИ, не предлагай оператора.',
    ].join('\n');

    const history = await this.dialogService.getMessages(
      params.dialogId,
      params.tenantId,
    );
    const recentHistory = history
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-10);

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `${assembled.systemContent}\n\n${followUpInstruction}`,
      },
      ...recentHistory.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      {
        role: 'user',
        content:
          '(Посетитель пока не ответил. Напиши одно follow-up сообщение от себя.)',
      },
    ];

    const tariff = await this.tariffResolver.getEffectiveTariff(params.tenantId);
    const allowedProviders = (
      tariff?.featuresJson as { allowedProviders?: string[] } | undefined
    )?.allowedProviders;

    const tier = this.modelRouter.classify('', false);
    const chain = this.providers.getChainForTier(tier, allowedProviders);

    let fullResponse = '';
    let usedProvider = chain[chain.length - 1];
    let usedModel = usedProvider.defaultModel;

    for (const provider of chain) {
      try {
        usedProvider = provider;
        usedModel = provider.defaultModel;
        fullResponse = '';
        for await (const token of provider.streamChat(messages, { maxTokens: 400 })) {
          if (token.content) fullResponse += token.content;
          if (token.done) break;
        }
        break;
      } catch (error) {
        this.logger.warn(
          `Follow-up provider ${provider.name} failed: ${String(error)}`,
        );
        fullResponse = '';
      }
    }

    const content = fullResponse.trim();
    if (!content) return null;

    const promptTokens = usedProvider.estimateTokens(
      messages.map((m) => m.content).join('\n'),
    );
    const completionTokens = usedProvider.estimateTokens(content);

    const assistantMessage = await this.dialogService.addMessage({
      dialogId: params.dialogId,
      tenantId: params.tenantId,
      role: 'assistant',
      content,
      tokenCount: completionTokens,
      provider: usedProvider.name,
      model: usedModel,
    });

    await this.prisma.lLMUsageLog.create({
      data: {
        tenantId: params.tenantId,
        dialogId: params.dialogId,
        provider: usedProvider.name,
        model: usedModel,
        promptTokens,
        completionTokens,
        costUsd: new Prisma.Decimal(
          calculateCostUsd(usedProvider.name, promptTokens, completionTokens),
        ),
      },
    });

    return { messageId: assistantMessage.id, content };
  }
}
