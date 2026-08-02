import { encode } from 'gpt-tokenizer';
import type {
  ChatMessage,
  LLMProviderAdapter,
  StreamChatOptions,
  StreamToken,
} from './llm-provider.interface';

export abstract class BaseOpenAiCompatibleProvider
  implements LLMProviderAdapter
{
  abstract readonly name: string;
  abstract readonly defaultModel: string;
  protected _apiKey: string | undefined;
  protected abstract readonly baseUrl: string;

  setApiKey(key: string | undefined) {
    this._apiKey = key;
  }

  protected get apiKey(): string | undefined {
    return this._apiKey;
  }

  protected extraHeaders(): Record<string, string> {
    return {};
  }

  isAvailable(): boolean {
    return Boolean(this._apiKey);
  }

  getMaskedApiKey(): string | null {
    if (!this._apiKey) return null;
    if (this._apiKey.length <= 8) return '••••••••';
    return `${this._apiKey.slice(0, 4)}…${this._apiKey.slice(-4)}`;
  }

  estimateTokens(text: string): number {
    return encode(text).length;
  }

  async *streamChat(
    messages: ChatMessage[],
    opts?: StreamChatOptions,
  ): AsyncIterable<StreamToken> {
    if (!this.apiKey) throw new Error(`${this.name} API key not configured`);

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...this.extraHeaders(),
      },
      body: JSON.stringify({
        model: opts?.model ?? this.defaultModel,
        messages,
        temperature: opts?.temperature ?? 0.7,
        max_tokens: opts?.maxTokens ?? 1024,
        stream: true,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`${this.name} API error: ${response.status} ${body}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Empty response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') {
          yield { content: '', done: true };
          return;
        }
        try {
          const json = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const token = json.choices?.[0]?.delta?.content ?? '';
          if (token) yield { content: token };
        } catch {
          // skip malformed chunks
        }
      }
    }

    yield { content: '', done: true };
  }
}
