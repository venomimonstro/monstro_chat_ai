import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { LLMProviderAdapter } from './llm-provider.interface';
import { OpenAIProvider } from './openai.provider';
import { DeepSeekProvider } from './deepseek.provider';
import { AnthropicProvider } from './anthropic.provider';
import { MockLLMProvider } from './mock.provider';
import type { ModelTier } from '../services/model-router.service';
import { ProviderConfigService } from '../services/provider-config.service';
import { ProviderCredentialsService } from '../services/provider-credentials.service';

export interface AdminProviderDto {
  name: string;
  defaultModel: string;
  available: boolean;
  enabled: boolean;
  inChain: boolean;
  priority: number;
  apiKeyMasked: string | null;
}

@Injectable()
export class ProviderRegistryService implements OnModuleInit {
  private readonly logger = new Logger(ProviderRegistryService.name);
  private readonly byName: Record<string, LLMProviderAdapter & { getMaskedApiKey?: () => string | null }>;
  private readonly cheapOrder = ['deepseek', 'mock'];
  private readonly premiumOrder = ['openai', 'anthropic', 'deepseek', 'mock'];

  constructor(
    config: ConfigService,
    deepseek: DeepSeekProvider,
    openai: OpenAIProvider,
    anthropic: AnthropicProvider,
    mock: MockLLMProvider,
    private readonly providerConfig: ProviderConfigService,
    private readonly credentials: ProviderCredentialsService,
  ) {
    this.byName = {
      deepseek,
      openai,
      anthropic,
      mock,
    };

    this.credentials.registerProviders({
      deepseek,
      openai,
      anthropic,
    });

    const configured = config.get<string>(
      'LLM_PROVIDER_CHAIN',
      'deepseek,openai,anthropic,mock',
    );
    this.logger.log(`LLM default chain: ${configured}`);
  }

  async onModuleInit() {
    await this.providerConfig.refresh();
  }

  getChain(): LLMProviderAdapter[] {
    const { chain, disabled } = this.providerConfig.getConfigSync();
    const activeChain = chain.filter((name) => !disabled.includes(name));
    return this.resolveChain(activeChain.length ? activeChain : chain);
  }

  getChainForTier(
    tier: ModelTier,
    allowedProviders?: string[],
  ): LLMProviderAdapter[] {
    const order = tier === 'cheap' ? this.cheapOrder : this.premiumOrder;
    const { disabled } = this.providerConfig.getConfigSync();
    const filtered = allowedProviders?.length
      ? order.filter((name) => allowedProviders.includes(name))
      : order;
    const active = filtered.filter((name) => !disabled.includes(name));
    return this.resolveChain(active.length ? active : filtered);
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

  getAvailableProviders(): LLMProviderAdapter[] {
    return this.getChain();
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
      };
    });
  }

  async updateAdminConfig(data: { chain: string[]; disabled: string[] }) {
    await this.providerConfig.saveConfig(data);
    return this.listForAdmin();
  }

  async setProviderCredentials(name: string, apiKey: string) {
    if (!this.byName[name] || name === 'mock') {
      throw new Error(`Unknown provider: ${name}`);
    }
    await this.credentials.saveCredential(name, apiKey);
    return this.listForAdmin();
  }

  async clearProviderCredentials(name: string) {
    if (!this.byName[name] || name === 'mock') {
      throw new Error(`Unknown provider: ${name}`);
    }
    await this.credentials.clearCredential(name);
    return this.listForAdmin();
  }
}
