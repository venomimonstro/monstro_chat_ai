import { Module, forwardRef } from '@nestjs/common';
import { AiController } from './ai.controller';
import { DialogsController } from './dialogs.controller';
import { AiService } from './ai.service';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { RedisModule } from '../../redis/redis.module';
import { CrmModule } from '../crm/crm.module';
import { BillingModule } from '../billing/billing.module';
import { OpenAIProvider } from './providers/openai.provider';
import { DeepSeekProvider } from './providers/deepseek.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { OpenRouterProvider } from './providers/openrouter.provider';
import { MockLLMProvider } from './providers/mock.provider';
import { ProviderRegistryService } from './providers/provider-registry.service';
import { RetrievalService } from './services/retrieval.service';
import { DialogService } from './services/dialog.service';
import { DialogsService } from './services/dialogs.service';
import { WidgetRateLimitService } from './services/widget-rate-limit.service';
import { HistoryCompressionService } from './services/history-compression.service';
import { AiOrchestratorService } from './services/ai-orchestrator.service';
import { PromptAssemblyService } from './services/prompt-assembly.service';
import { AntiInjectionService } from './services/anti-injection.service';
import { ModelRouterService } from './services/model-router.service';
import { SemanticCacheService } from './services/semantic-cache.service';
import { ProviderConfigService } from './services/provider-config.service';
import { ProviderCredentialsService } from './services/provider-credentials.service';
import { IntegrationsModule } from '../integrations/integrations.module';
import { PromptExperimentModule } from '../prompts/prompt-experiment.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [
    forwardRef(() => KnowledgeModule),
    forwardRef(() => CrmModule),
    BillingModule,
    RedisModule,
    IntegrationsModule,
    PromptExperimentModule,
    AnalyticsModule,
  ],
  controllers: [AiController, DialogsController],
  providers: [
    AiService,
    OpenAIProvider,
    DeepSeekProvider,
    AnthropicProvider,
    OpenRouterProvider,
    MockLLMProvider,
    ProviderRegistryService,
    ProviderConfigService,
    ProviderCredentialsService,
    RetrievalService,
    DialogService,
    DialogsService,
    WidgetRateLimitService,
    HistoryCompressionService,
    AiOrchestratorService,
    PromptAssemblyService,
    AntiInjectionService,
    ModelRouterService,
    SemanticCacheService,
  ],
  exports: [
    AiOrchestratorService,
    DialogService,
    WidgetRateLimitService,
    ProviderRegistryService,
    ProviderCredentialsService,
    MockLLMProvider,
    RetrievalService,
    PromptAssemblyService,
    AntiInjectionService,
    SemanticCacheService,
    ModelRouterService,
  ],
})
export class AiModule {}
