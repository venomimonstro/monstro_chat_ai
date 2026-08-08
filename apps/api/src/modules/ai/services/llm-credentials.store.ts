import type { RedisService } from '../../../redis/redis.service';
import type { CredentialCryptoService } from '../../integrations/services/credential-crypto.service';

export const LLM_CREDENTIALS_REDIS_KEY = 'admin:llm-provider-credentials';

export type LlmProviderName = 'openai' | 'deepseek' | 'anthropic' | 'openrouter';

export interface LoadedLlmCredentials {
  keys: Partial<Record<LlmProviderName, string>>;
  decryptFailed: LlmProviderName[];
  storedInRedis: Set<LlmProviderName>;
}

export async function loadLlmCredentialsFromRedis(
  redis: RedisService,
  crypto: CredentialCryptoService,
): Promise<LoadedLlmCredentials> {
  const client = redis.getClient();
  const result: LoadedLlmCredentials = {
    keys: {},
    decryptFailed: [],
    storedInRedis: new Set(),
  };

  if (!client) return result;

  const raw = await client.get(LLM_CREDENTIALS_REDIS_KEY);
  if (!raw) return result;

  let stored: Record<string, string>;
  try {
    stored = JSON.parse(raw) as Record<string, string>;
  } catch {
    return result;
  }

  for (const [name, encrypted] of Object.entries(stored)) {
    const normalized = name.trim().toLowerCase() as LlmProviderName;
    result.storedInRedis.add(normalized);
    try {
      result.keys[normalized] = crypto.decrypt(encrypted);
    } catch {
      result.decryptFailed.push(normalized);
    }
  }

  return result;
}
