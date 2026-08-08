import { Injectable, Logger, NotFoundException, OnModuleInit, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { LLMProviderAdapter } from './llm-provider.interface';
import { OpenAIProvider } from './openai.provider';
import { DeepSeekProvider } from './deepseek.provider';
import { AnthropicProvider } from './anthropic.provider';
import { OpenRouterProvider } from './openrouter.provider';
import { MockLLMProvider } from './mock.provider';
import { parseLlmProviderError } from './llm-provider-errors';
import type { ModelTier } from '../services/model-router.service';
import { ProviderConfigService } from '../services/provider-config.service';
import { ProviderCredentialsService, type LlmKeySource } from '../services/provider-credentials.service';

export interface ProviderTestResultDto {
  ok: boolean;
  provider: string;
  model: string;
  latencyMs: number;
  error?: string;
  errorCode?: string;
  hint?: string;
}

export interface AdminProviderDto {
  name: string;
  defaultModel: string;
  available: boolean;
  enabled: boolean;
  inChain: boolean;
  priority: number;
  apiKeyMasked: string | null;
  keySource: LlmKeySource;
}

@Injectable()
export class ProviderRegistryService implements OnModuleInit {
  private readonly logger = new Logger(ProviderRegistryService.name);
  private readonly byName: Record<string, LLMProviderAdapter & { getMaskedApiKey?: () => string | null }>;
  private readonly cheapOrder = ['openrouter', 'deepseek', 'mock'];
  private readonly premiumOrder = ['openai', 'anthropic', 'openrouter', 'deepseek', 'mock'];

  constructor(
    config: ConfigService,
    deepseek: DeepSeekProvider,
    openai: OpenAIProvider,
    anthropic: AnthropicProvider,
    openrouter: OpenRouterProvider,
    mock: MockLLMProvider,
    private readonly providerConfig: ProviderConfigService,
    private readonly credentials: ProviderCredentialsService,
  ) {
    this.byName = {
      deepseek,
      openai,
      anthropic,
      openrouter,
      mock,
    };

    this.credentials.registerProviders({
      deepseek,
      openai,
      anthropic,
      openrouter,
    });

    const configured = config.get<string>(
      'LLM_PROVIDER_CHAIN',
      'openrouter,deepseek,openai,anthropic,mock',
    );
    this.logger.log(`LLM default chain: ${configured}`);
  }

  async onModuleInit() {
    await this.providerConfig.refresh();
    await this.credentials.loadAndApply();
  }

  getChainForTier(
    tier: ModelTier,
    allowedProviders?: string[],
  ): LLMProviderAdapter[] {
    const { chain, disabled } = this.providerConfig.getConfigSync();
    const tierPriority = tier === 'cheap' ? this.cheapOrder : this.premiumOrder;

    const activeAdminChain = chain.filter((name) => !disabled.includes(name));
    const base = allowedProviders?.length
      ? activeAdminChain.filter((name) => allowedProviders.includes(name))
      : activeAdminChain;

    const ordered = [
      ...tierPriority.filter((name) => base.includes(name)),
      ...base.filter((name) => !tierPriority.includes(name)),
    ].filter((name) => name !== 'mock');

    const names = ordered.length ? ordered : tierPriority.filter((n) => n !== 'mock');
    return this.resolveChain(names);
  }

  private resolveChain(names: string[]): LLMProviderAdapter[] {
    const result: LLMProviderAdapter[] = [];
    for (const name of names) {
      const provider = this.byName[name];
      if (!provider) continue;
      if (provider.name === 'mock') continue;
      if (provider.isAvailable()) result.push(provider);
    }
    const mock = this.byName.mock;
    if (mock) result.push(mock);
    return result.length ? result : [mock];
  }

  getChain(): LLMProviderAdapter[] {
    const { chain, disabled } = this.providerConfig.getConfigSync();
    const activeChain = chain.filter((name) => !disabled.includes(name));
    return this.resolveChain(activeChain.length ? activeChain : chain);
  }

  getAvailableProviders(): LLMProviderAdapter[] {
    return this.getChain();
  }

  async auditAllProviders(): Promise<ProviderTestResultDto[]> {
    const names = Object.keys(this.byName).filter((n) => n !== 'mock');
    const results: ProviderTestResultDto[] = [];
    for (const name of names) {
      if (!this.byName[name]?.isAvailable()) {
        results.push({
          ok: false,
          provider: name,
          model: this.byName[name]?.defaultModel ?? '',
          latencyMs: 0,
          error: 'API-ключ не задан',
          errorCode: 'invalid_key',
          hint: 'Сохраните ключ в админке или пропишите в .env',
        });
        continue;
      }
      results.push(await this.testProvider(name));
    }
    return results;
  }

  listForAdmin(): AdminProviderDto[] {
    const { chain, disabled } = this.providerConfig.getConfigSync();
    const allNames = Object.keys(this.byName);
    const ordered = [
      ...chain.filter((n) => allNames.includes(n)),
      ...allNames.filter((n) => !chain.includes(n)),
    ];

    return ordered.map((name, index) => {
      const provider = this.byName[name];
      const enabled = !disabled.includes(name);
      return {
        name: provider.name,
        defaultModel: provider.defaultModel,
        available: provider.isAvailable(),
        enabled,
        inChain: chain.includes(name) && enabled,
        priority: index + 1,
        apiKeyMasked: provider.getMaskedApiKey?.() ?? null,
        keySource: this.credentials.getKeySource(name),
      };
    });
  }

  async updateAdminConfig(data: { chain: string[]; disabled: string[] }) {
    await this.providerConfig.saveConfig(data);
    return this.listForAdmin();
  }

  async setProviderCredentials(name: string, apiKey: string) {
    const normalized = name.trim().toLowerCase();
    if (!this.byName[normalized] || normalized === 'mock') {
      throw new NotFoundException(`Неизвестный провайдер: ${name}`);
    }
    await this.credentials.saveCredential(normalized, apiKey);
    return this.listForAdmin();
  }

  async clearProviderCredentials(name: string) {
    const normalized = name.trim().toLowerCase();
    if (!this.byName[normalized] || normalized === 'mock') {
      throw new NotFoundException(`Неизвестный провайдер: ${name}`);
    }
    await this.credentials.clearCredential(normalized);
    return this.listForAdmin();
  }

  async testProvider(name: string, apiKey?: string): Promise<ProviderTestResultDto> {
    const normalized = name.trim().toLowerCase();
    const provider = this.byName[normalized];
    if (!provider || normalized === 'mock') {
      throw new NotFoundException(`Неизвестный провайдер: ${name}`);
    }

    const draftKey = apiKey?.trim();
    if (!draftKey && !provider.isAvailable()) {
      throw new BadRequestException('API-ключ не задан');
    }

    if (draftKey) {
      provider.setApiKey?.(draftKey);
    }

    const started = Date.now();
    try {
      let gotToken = false;
      for await (const token of provider.streamChat(
        [{ role: 'user', content: 'Reply with exactly: OK' }],
        { maxTokens: 8, temperature: 0 },
      )) {
        if (token.content) gotToken = true;
        if (token.done) break;
      }

      if (!gotToken) {
        return {
          ok: false,
          provider: provider.name,
          model: provider.defaultModel,
          latencyMs: Date.now() - started,
          error: 'Пустой ответ от провайдера',
          errorCode: 'unknown',
          hint: 'Ключ принят, но модель не вернула текст — проверьте модель',
        };
      }

      return {
        ok: true,
        provider: provider.name,
        model: provider.defaultModel,
        latencyMs: Date.now() - started,
      };
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error);
      const parsed = parseLlmProviderError(raw);
      return {
        ok: false,
        provider: provider.name,
        model: provider.defaultModel,
        latencyMs: Date.now() - started,
        error: parsed.error,
        errorCode: parsed.errorCode,
        hint: parsed.hint,
      };
    } finally {
      if (draftKey) {
        await this.credentials.loadAndApply();
      }
    }
  }
}
