import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { SourceConfig } from '@ai-consultant/shared-types';
import { RetrievalService } from './retrieval.service';
import { DialogService } from './dialog.service';
import { HistoryCompressionService } from './history-compression.service';
import { ProviderRegistryService } from '../providers/provider-registry.service';
import { calculateCostUsd } from '../constants';
import type { ChatMessage } from '../providers/llm-provider.interface';
import { PrismaService } from '../../../prisma/prisma.service';
import { PromptAssemblyService } from './prompt-assembly.service';
import { AntiInjectionService } from './anti-injection.service';
import { LeadExtractionService } from '../../crm/services/lead-extraction.service';
import { LeadDedupService } from '../../crm/services/lead-dedup.service';
import { UsageLimitService } from '../../billing/services/usage-limit.service';
import { TariffResolverService } from '../../billing/services/tariff-resolver.service';
import { ModelRouterService } from './model-router.service';
import { SemanticCacheService } from './semantic-cache.service';
import { PromptExperimentService } from '../../prompts/prompt-experiment.service';
import {
  TrialExpiredException,
  UsageLimitExceededException,
  TenantSuspendedException,
} from '../../billing/billing.errors';
import type { DialogAttributionInput } from '../../integrations/attribution.util';

export interface OrchestratorInput {
  tenantId: string;
  sourceId: string;
  visitorId: string;
  dialogId?: string;
  content: string;
  sourceConfig: SourceConfig;
  attribution?: DialogAttributionInput;
}

export interface StreamChunk {
  type: 'dialog' | 'token' | 'done' | 'error';
  dialogId?: string;
  messageId?: string;
  token?: string;
  content?: string;
  provider?: string;
  model?: string;
  error?: string;
  code?: string;
}

@Injectable()
export class AiOrchestratorService {
  private readonly logger = new Logger(AiOrchestratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly retrieval: RetrievalService,
    private readonly dialogService: DialogService,
    private readonly historyCompression: HistoryCompressionService,
    private readonly providers: ProviderRegistryService,
    private readonly promptAssembly: PromptAssemblyService,
    private readonly antiInjection: AntiInjectionService,
    private readonly leadExtraction: LeadExtractionService,
    private readonly leadDedup: LeadDedupService,
    private readonly usageLimit: UsageLimitService,
    private readonly tariffResolver: TariffResolverService,
    private readonly modelRouter: ModelRouterService,
    private readonly semanticCache: SemanticCacheService,
    private readonly promptExperiments: PromptExperimentService,
  ) {}

  async processMessage(
    input: OrchestratorInput,
  ): Promise<{ dialogId: string; content: string }> {
    let dialogId = '';
    let content = '';
    for await (const chunk of this.streamResponse(input)) {
      if (chunk.type === 'dialog' && chunk.dialogId) dialogId = chunk.dialogId;
      if (chunk.type === 'done' && chunk.content) content = chunk.content;
      if (chunk.type === 'error') {
        throw new Error(chunk.error ?? 'Ошибка обработки сообщения');
      }
    }
    return { dialogId, content };
  }

  async *streamResponse(
    input: OrchestratorInput,
  ): AsyncGenerator<StreamChunk> {
    try {
      if (!input.dialogId) {
        await this.usageLimit.assertCanCreateDialog(input.tenantId);
      }
      await this.usageLimit.assertCanSendMessage(input.tenantId);
    } catch (error) {
      if (
        error instanceof TrialExpiredException ||
        error instanceof UsageLimitExceededException ||
        error instanceof TenantSuspendedException
      ) {
        const body = error.getResponse() as {
          message: string;
          code: string;
        };
        yield {
          type: 'error',
          error: body.message,
          code: body.code,
        };
        return;
      }
      throw error;
    }

    const dialog = await this.dialogService.getOrCreateDialog(
      input.tenantId,
      input.sourceId,
      input.visitorId,
      input.dialogId,
      input.attribution,
    );

    const effective = await this.leadDedup.resolveEffectiveDialog(
      input.tenantId,
      dialog.id,
    );
    const activeDialogId = effective.dialogId;

    yield { type: 'dialog', dialogId: activeDialogId };

    await this.dialogService.addMessage({
      dialogId: activeDialogId,
      tenantId: input.tenantId,
      role: 'user',
      content: input.content,
    });

    await this.leadExtraction.processMessage({
      tenantId: input.tenantId,
      sourceId: input.sourceId,
      dialogId: activeDialogId,
      sessionDialogId: dialog.id,
      content: input.content,
      sourceConfig: input.sourceConfig,
    });

    const activeDialog =
      activeDialogId === dialog.id
        ? dialog
        : ((await this.prisma.dialog.findUnique({
            where: { id: activeDialogId },
          })) ?? dialog);

    const injection = this.antiInjection.classify(input.content);
    if (injection.isSuspicious) {
      this.logger.warn(`Suspicious message in dialog ${activeDialogId}`);
    }

    if (injection.shouldBlock && injection.blockedReply) {
      const blocked = injection.blockedReply;
      const assistantMessage = await this.dialogService.addMessage({
        dialogId: activeDialogId,
        tenantId: input.tenantId,
        role: 'assistant',
        content: blocked,
        tokenCount: 0,
        provider: 'safety',
        model: 'blocked',
      });

      yield {
        type: 'done',
        dialogId: activeDialogId,
        messageId: assistantMessage.id,
        content: blocked,
        provider: 'safety',
        model: 'blocked',
      };
      return;
    }

    const cacheHit = await this.semanticCache.lookup(
      input.tenantId,
      input.content,
    );

    const used = await this.usageLimit.recordMessage(input.tenantId);
    await this.usageLimit.chargeOverage(input.tenantId, used);

    if (cacheHit) {
      const fullResponse = cacheHit.answer;
      for (const token of this.chunkText(fullResponse)) {
        yield {
          type: 'token',
          dialogId: activeDialogId,
          token,
          provider: 'cache',
          model: 'semantic-cache',
        };
      }

      const assistantMessage = await this.dialogService.addMessage({
        dialogId: activeDialogId,
        tenantId: input.tenantId,
        role: 'assistant',
        content: fullResponse,
        tokenCount: 0,
        provider: 'cache',
        model: 'semantic-cache',
      });

      await this.prisma.lLMUsageLog.create({
        data: {
          tenantId: input.tenantId,
          dialogId: activeDialogId,
          provider: 'cache',
          model: 'semantic-cache',
          promptTokens: 0,
          completionTokens: 0,
          costUsd: new Prisma.Decimal(0),
        },
      });

      yield {
        type: 'done',
        dialogId: activeDialogId,
        messageId: assistantMessage.id,
        content: fullResponse,
        provider: 'cache',
        model: 'semantic-cache',
      };
      return;
    }

    const retrieval = await this.retrieval.search(
      input.tenantId,
      input.sourceId,
      input.content,
    );
    const contextBlock = this.retrieval.formatRagContext(retrieval);

    const experimentPrompt = await this.promptExperiments.resolveClientPrompt(
      input.tenantId,
      activeDialogId,
    );

    const leadState = await this.leadExtraction.getLeadState({
      tenantId: input.tenantId,
      dialogId: activeDialogId,
      sessionDialogId: dialog.id,
      sourceConfig: input.sourceConfig,
      lastUserMessage: input.content,
    });

    const assembled = await this.promptAssembly.assemble({
      tenantId: input.tenantId,
      dialogId: activeDialogId,
      ragContext: contextBlock,
      dialogSummary: activeDialog.summary,
      fallbackClientPrompt: input.sourceConfig.ai?.clientPrompt,
      clientPromptOverride: experimentPrompt,
      antiInjectionInstruction: injection.instruction,
      leadGoalInstruction: leadState.instruction,
      personaConfig: input.sourceConfig.ai,
      insufficientContext: !retrieval.sufficient,
    });

    const history = await this.dialogService.getMessages(
      activeDialogId,
      input.tenantId,
    );
    const recentHistory = history
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-12);

    const messages: ChatMessage[] = [
      { role: 'system', content: assembled.systemContent },
      ...recentHistory.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    const tariff = await this.tariffResolver.getEffectiveTariff(input.tenantId);
    const allowedProviders = (
      tariff?.featuresJson as { allowedProviders?: string[] } | undefined
    )?.allowedProviders;

    const tier = this.modelRouter.classify(input.content, Boolean(cacheHit));
    const chain = this.providers.getChainForTier(tier, allowedProviders);
    this.logger.debug(
      `Model router: tier=${tier}, chain=${chain.map((p) => p.name).join('→')}`,
    );

    let fullResponse = '';
    let usedProvider = chain[chain.length - 1];
    let usedModel = usedProvider.defaultModel;
    let lastError: Error | null = null;

    for (const provider of chain) {
      try {
        usedProvider = provider;
        usedModel = provider.defaultModel;
        fullResponse = '';

        for await (const token of provider.streamChat(messages)) {
          if (token.content) {
            fullResponse += token.content;
            yield {
              type: 'token',
              dialogId: activeDialogId,
              token: token.content,
              provider: provider.name,
              model: usedModel,
            };
          }
          if (token.done) break;
        }

        lastError = null;
        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(
          `Provider ${provider.name} failed, trying fallback: ${lastError.message}`,
        );
        fullResponse = '';
      }
    }

    if (lastError && !fullResponse) {
      yield {
        type: 'error',
        dialogId: activeDialogId,
        error: 'Не удалось получить ответ. Попробуйте позже.',
      };
      return;
    }

    const promptTokens = usedProvider.estimateTokens(
      messages.map((m) => m.content).join('\n'),
    );
    const completionTokens = usedProvider.estimateTokens(fullResponse);

    const assistantMessage = await this.dialogService.addMessage({
      dialogId: activeDialogId,
      tenantId: input.tenantId,
      role: 'assistant',
      content: fullResponse,
      tokenCount: completionTokens,
      provider: usedProvider.name,
      model: usedModel,
    });

    await this.prisma.lLMUsageLog.create({
      data: {
        tenantId: input.tenantId,
        dialogId: activeDialogId,
        provider: usedProvider.name,
        model: usedModel,
        promptTokens,
        completionTokens,
        costUsd: new Prisma.Decimal(
          calculateCostUsd(
            usedProvider.name,
            promptTokens,
            completionTokens,
          ),
        ),
      },
    });

    await this.historyCompression.compressIfNeeded(
      activeDialogId,
      input.tenantId,
    );

    await this.semanticCache.store(
      input.tenantId,
      input.content,
      fullResponse,
      usedProvider.name,
      usedModel,
    );

    yield {
      type: 'done',
      dialogId: activeDialogId,
      messageId: assistantMessage.id,
      content: fullResponse,
      provider: usedProvider.name,
      model: usedModel,
    };
  }

  private *chunkText(text: string, size = 24): Generator<string> {
    for (let i = 0; i < text.length; i += size) {
      yield text.slice(i, i + size);
    }
  }
}
