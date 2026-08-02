import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../redis/redis.service';
import { CredentialCryptoService } from '../../integrations/services/credential-crypto.service';
import type { OpenAIProvider } from '../providers/openai.provider';
import type { DeepSeekProvider } from '../providers/deepseek.provider';
import type { AnthropicProvider } from '../providers/anthropic.provider';
import type { OpenRouterProvider } from '../providers/openrouter.provider';

const REDIS_KEY = 'admin:llm-provider-credentials';

type CredentialProvider =
  | OpenAIProvider
  | DeepSeekProvider
  | AnthropicProvider
  | OpenRouterProvider;

@Injectable()
export class ProviderCredentialsService implements OnModuleInit {
  private readonly logger = new Logger(ProviderCredentialsService.name);
  private readonly envKeys: Record<string, string | undefined>;
  private providers: Record<string, CredentialProvider> = {};
  private storedInRedis = new Set<string>();

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

  async onModuleInit() {
    await this.loadAndApply();
  }

  async loadAndApply(): Promise<void> {
    const stored = await this.loadStoredDecrypted();
    this.storedInRedis = new Set(Object.keys(stored));
    for (const [name, provider] of Object.entries(this.providers)) {
      const key = stored[name] ?? this.envKeys[name];
      provider.setApiKey(key);
    }
  }

  async saveCredential(name: string, apiKey: string): Promise<void> {
    const normalized = name.trim().toLowerCase();
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
    await client.set(REDIS_KEY, JSON.stringify(stored));
    this.storedInRedis.add(normalized);

    const provider = this.providers[normalized];
    if (provider) {
      provider.setApiKey(trimmed);
    }
    this.logger.log(`API key saved for provider: ${normalized}`);
  }

  async clearCredential(name: string): Promise<void> {
    const normalized = name.trim().toLowerCase();
    const client = this.redis.getClient();
    if (!client) {
      throw new ServiceUnavailableException('Redis недоступен');
    }
    const stored = await this.loadStored();
    delete stored[normalized];
    await client.set(REDIS_KEY, JSON.stringify(stored));
    this.storedInRedis.delete(normalized);

    const provider = this.providers[normalized];
    if (provider) {
      provider.setApiKey(this.envKeys[normalized]);
    }
    this.logger.log(`API key cleared for provider: ${normalized}`);
  }

  getKeySource(name: string): 'redis' | 'env' | 'none' {
    const normalized = name.trim().toLowerCase();
    if (this.storedInRedis.has(normalized)) return 'redis';
    if (this.envKeys[normalized]) return 'env';
    return 'none';
  }

  private async loadStored(): Promise<Record<string, string>> {
    const client = this.redis.getClient();
    if (!client) return {};
    const raw = await client.get(REDIS_KEY);
    if (!raw) return {};
    try {
      return JSON.parse(raw) as Record<string, string>;
    } catch {
      return {};
    }
  }

  private async decryptStored(stored: Record<string, string>): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    for (const [name, encrypted] of Object.entries(stored)) {
      try {
        result[name] = this.crypto.decrypt(encrypted);
      } catch {
        this.logger.warn(`Failed to decrypt credential for ${name}`);
      }
    }
    return result;
  }

  private async loadStoredDecrypted(): Promise<Record<string, string>> {
    const raw = await this.loadStored();
    const decrypted = await this.decryptStored(raw);
    this.storedInRedis = new Set(Object.keys(raw));
    return decrypted;
  }
}
