import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../redis/redis.service';
import { CredentialCryptoService } from '../../integrations/services/credential-crypto.service';
import type { OpenAIProvider } from '../providers/openai.provider';
import type { DeepSeekProvider } from '../providers/deepseek.provider';
import type { AnthropicProvider } from '../providers/anthropic.provider';

const REDIS_KEY = 'admin:llm-provider-credentials';

type CredentialProvider = OpenAIProvider | DeepSeekProvider | AnthropicProvider;

@Injectable()
export class ProviderCredentialsService implements OnModuleInit {
  private readonly logger = new Logger(ProviderCredentialsService.name);
  private readonly envKeys: Record<string, string | undefined>;
  private providers: Record<string, CredentialProvider> = {};

  constructor(
    private readonly redis: RedisService,
    private readonly crypto: CredentialCryptoService,
    config: ConfigService,
  ) {
    this.envKeys = {
      openai: config.get<string>('OPENAI_API_KEY'),
      deepseek: config.get<string>('DEEPSEEK_API_KEY'),
      anthropic: config.get<string>('ANTHROPIC_API_KEY'),
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
    for (const [name, provider] of Object.entries(this.providers)) {
      const key = stored[name] ?? this.envKeys[name];
      provider.setApiKey(key);
    }
  }

  async saveCredential(name: string, apiKey: string): Promise<void> {
    const client = this.redis.getClient();
    if (!client) {
      throw new Error('Redis unavailable');
    }
    const stored = await this.loadStored();
    stored[name] = this.crypto.encrypt(apiKey.trim());
    await client.set(REDIS_KEY, JSON.stringify(stored));
    const provider = this.providers[name];
    if (provider) {
      provider.setApiKey(apiKey.trim());
    }
    this.logger.log(`API key saved for provider: ${name}`);
  }

  async clearCredential(name: string): Promise<void> {
    const client = this.redis.getClient();
    if (!client) {
      throw new Error('Redis unavailable');
    }
    const stored = await this.loadStored();
    delete stored[name];
    await client.set(REDIS_KEY, JSON.stringify(stored));
    const provider = this.providers[name];
    if (provider) {
      provider.setApiKey(this.envKeys[name]);
    }
    this.logger.log(`API key cleared for provider: ${name}`);
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
    return this.decryptStored(await this.loadStored());
  }

  async getEffectiveKey(name: string): Promise<string | undefined> {
    const stored = await this.loadStoredDecrypted();
    return stored[name] ?? this.envKeys[name];
  }
}
