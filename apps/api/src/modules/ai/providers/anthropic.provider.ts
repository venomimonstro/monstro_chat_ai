import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { encode } from 'gpt-tokenizer';
import type {
  ChatMessage,
  LLMProviderAdapter,
  StreamChatOptions,
  StreamToken,
} from './llm-provider.interface';

@Injectable()
export class AnthropicProvider implements LLMProviderAdapter {
  readonly name = 'anthropic';
  readonly defaultModel: string;
  private readonly apiKey: string | undefined;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('ANTHROPIC_API_KEY');
    this.defaultModel = config.get<string>(
      'ANTHROPIC_MODEL',
      'claude-3-5-haiku-20241022',
    );
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey);
  }

  getMaskedApiKey(): string | null {
    if (!this.apiKey) return null;
    if (this.apiKey.length <= 8) return '••••••••';
    return `${this.apiKey.slice(0, 4)}…${this.apiKey.slice(-4)}`;
  }

  estimateTokens(text: string): number {
    return encode(text).length;
  }

  async *streamChat(
    messages: ChatMessage[],
    opts?: StreamChatOptions,
  ): AsyncIterable<StreamToken> {
    if (!this.apiKey) throw new Error('Anthropic API key not configured');

    const system = messages.find((m) => m.role === 'system')?.content;
    const chatMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: opts?.model ?? this.defaultModel,
        max_tokens: opts?.maxTokens ?? 1024,
        system,
        messages: chatMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Anthropic API error: ${response.status} ${body}`);
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
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        try {
          const json = JSON.parse(payload) as {
            type?: string;
            delta?: { text?: string };
          };
          if (json.type === 'content_block_delta' && json.delta?.text) {
            yield { content: json.delta.text };
          }
        } catch {
          // skip
        }
      }
    }

    yield { content: '', done: true };
  }
}
