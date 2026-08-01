import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../redis/redis.service';

export interface LlmProviderRuntimeConfig {
  chain: string[];
  disabled: string[];
}

const REDIS_KEY = 'admin:llm-provider-config';

@Injectable()
export class ProviderConfigService implements OnModuleInit {
  private cached: LlmProviderRuntimeConfig = { chain: [], disabled: [] };
  private readonly defaultChain: string[];

  constructor(
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.defaultChain = config
      .get<string>('LLM_PROVIDER_CHAIN', 'deepseek,openai,anthropic,mock')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    this.cached = { chain: this.defaultChain, disabled: [] };
  }

  async onModuleInit() {
    await this.refresh();
  }

  getDefaultChain(): string[] {
    return [...this.defaultChain];
  }

  getConfigSync(): LlmProviderRuntimeConfig {
    return this.cached;
  }

  async refresh(): Promise<LlmProviderRuntimeConfig> {
    const client = this.redis.getClient();
    if (!client) {
      this.cached = { chain: this.defaultChain, disabled: [] };
      return this.cached;
    }
    const raw = await client.get(REDIS_KEY);
    if (!raw) {
      this.cached = { chain: this.defaultChain, disabled: [] };
      return this.cached;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<LlmProviderRuntimeConfig>;
      this.cached = {
        chain: parsed.chain?.length ? parsed.chain : this.defaultChain,
        disabled: parsed.disabled ?? [],
      };
    } catch {
      this.cached = { chain: this.defaultChain, disabled: [] };
    }
    return this.cached;
  }

  async saveConfig(config: LlmProviderRuntimeConfig): Promise<LlmProviderRuntimeConfig> {
    const client = this.redis.getClient();
    if (!client) {
      throw new Error('Redis unavailable');
    }
    const normalized: LlmProviderRuntimeConfig = {
      chain: config.chain.map((s) => s.trim().toLowerCase()).filter(Boolean),
      disabled: config.disabled.map((s) => s.trim().toLowerCase()).filter(Boolean),
    };
    await client.set(REDIS_KEY, JSON.stringify(normalized));
    this.cached = normalized;
    return normalized;
  }
}
