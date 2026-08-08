import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../redis/redis.service';
import { CredentialCryptoService } from '../../integrations/services/credential-crypto.service';
import type { OpenAIProvider } from '../providers/openai.provider';
import type { DeepSeekProvider } from '../providers/deepseek.provider';
import type { AnthropicProvider } from '../providers/anthropic.provider';
import type { OpenRouterProvider } from '../providers/openrouter.provider';
import {
  LLM_CREDENTIALS_REDIS_KEY,
  loadLlmCredentialsFromRedis,
  type LlmProviderName,
} from './llm-credentials.store';

type CredentialProvider =
  | OpenAIProvider
  | DeepSeekProvider
  | AnthropicProvider
  | OpenRouterProvider;

export type LlmKeySource = 'redis' | 'env' | 'none' | 'corrupt';

@Injectable()
export class ProviderCredentialsService {
  private readonly logger = new Logger(ProviderCredentialsService.name);
  private readonly envKeys: Record<LlmProviderName, string | undefined>;
  private providers: Record<string, CredentialProvider> = {};
  private storedInRedis = new Set<string>();
  private decryptFailed = new Set<string>();
  private effectiveKeys: Partial<Record<LlmProviderName, string>> = {};

  constructor(
    private readonly redis: RedisService,
    private readonly crypto: CredentialCryptoService,
    config: ConfigService,
  ) {
    this.envKeys = {
      openai: config.get<string>('OPENAI_API_KEY'),
      deepseek: config.get<string>('DEEPSEEK_API_KEY'),
      anthropic: config.get<string>('ANTHROPIC_API_KEY'),
      openrouter: config.get<string>('OPENROUTER_API_KEY'),
    };
  }

  registerProviders(providers: Record<string, CredentialProvider>) {
    this.providers = providers;
  }

  async loadAndApply(): Promise<void> {
    const loaded = await loadLlmCredentialsFromRedis(this.redis, this.crypto);
    this.storedInRedis = new Set(loaded.storedInRedis);
    this.decryptFailed = new Set(loaded.decryptFailed);
    this.effectiveKeys = {};

    for (const name of loaded.decryptFailed) {
      this.logger.error(
        `Ключ ${name} в Redis не расшифровался — проверьте INTEGRATION_ENCRYPTION_KEY или сохраните ключ заново в админке`,
      );
    }

    for (const [name, provider] of Object.entries(this.providers)) {
      const normalized = name as LlmProviderName;
      const redisKey = loaded.keys[normalized];
      const key = redisKey ?? this.envKeys[normalized];
      this.effectiveKeys[normalized] = key;
      provider.setApiKey(key);
    }
  }

  getEffectiveKey(name: LlmProviderName): string | undefined {
    return this.effectiveKeys[name] ?? this.envKeys[name];
  }

  async saveCredential(name: string, apiKey: string): Promise<void> {
    const normalized = name.trim().toLowerCase() as LlmProviderName;
    const trimmed = apiKey.trim();
    if (!trimmed || trimmed.length < 8) {
      throw new BadRequestException('API-ключ должен содержать минимум 8 символов');
    }

    const client = this.redis.getClient();
    if (!client) {
      throw new ServiceUnavailableException('Redis недоступен — сохранение ключей невозможно');
    }

    const stored = await this.loadStored();
    stored[normalized] = this.crypto.encrypt(trimmed);
    await client.set(LLM_CREDENTIALS_REDIS_KEY, JSON.stringify(stored));
    this.storedInRedis.add(normalized);
    this.decryptFailed.delete(normalized);
    this.effectiveKeys[normalized] = trimmed;

    const provider = this.providers[normalized];
    if (provider) {
      provider.setApiKey(trimmed);
    }
    this.logger.log(`API key saved for provider: ${normalized}`);
  }

  async clearCredential(name: string): Promise<void> {
    const normalized = name.trim().toLowerCase() as LlmProviderName;
    const client = this.redis.getClient();
    if (!client) {
      throw new ServiceUnavailableException('Redis недоступен');
    }
    const stored = await this.loadStored();
    delete stored[normalized];
    await client.set(LLM_CREDENTIALS_REDIS_KEY, JSON.stringify(stored));
    this.storedInRedis.delete(normalized);
    this.decryptFailed.delete(normalized);

    const envKey = this.envKeys[normalized];
    this.effectiveKeys[normalized] = envKey;
    const provider = this.providers[normalized];
    if (provider) {
      provider.setApiKey(envKey);
    }
    this.logger.log(`API key cleared for provider: ${normalized}`);
  }

  getKeySource(name: string): LlmKeySource {
    const normalized = name.trim().toLowerCase();
    if (this.decryptFailed.has(normalized)) {
      return this.envKeys[normalized as LlmProviderName] ? 'env' : 'corrupt';
    }
    if (this.storedInRedis.has(normalized) && this.providers[normalized]?.isAvailable()) {
      return 'redis';
    }
    if (this.envKeys[normalized as LlmProviderName]) return 'env';
    return 'none';
  }

  getDiagnostics(): Array<{
    name: LlmProviderName;
    keySource: LlmKeySource;
    available: boolean;
    decryptFailed: boolean;
  }> {
    const names: LlmProviderName[] = ['openrouter', 'deepseek', 'openai', 'anthropic'];
    return names.map((name) => ({
      name,
      keySource: this.getKeySource(name),
      available: Boolean(this.providers[name]?.isAvailable()),
      decryptFailed: this.decryptFailed.has(name),
    }));
  }

  private async loadStored(): Promise<Record<string, string>> {
    const client = this.redis.getClient();
    if (!client) return {};
    const raw = await client.get(LLM_CREDENTIALS_REDIS_KEY);
    if (!raw) return {};
    try {
      return JSON.parse(raw) as Record<string, string>;
    } catch {
      return {};
    }
  }
}
