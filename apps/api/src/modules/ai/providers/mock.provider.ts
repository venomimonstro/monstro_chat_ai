import { Injectable } from '@nestjs/common';
import { encode } from 'gpt-tokenizer';
import type {
  ChatMessage,
  LLMProviderAdapter,
  StreamChatOptions,
  StreamToken,
} from './llm-provider.interface';

@Injectable()
export class MockLLMProvider implements LLMProviderAdapter {
  readonly name = 'mock';
  readonly defaultModel = 'mock-rag';

  isAvailable(): boolean {
    return true;
  }

  getMaskedApiKey(): string | null {
    return null;
  }

  estimateTokens(text: string): number {
    return encode(text).length;
  }

  async *streamChat(
    messages: ChatMessage[],
    _opts?: StreamChatOptions,
  ): AsyncIterable<StreamToken> {
    const system = messages.find((m) => m.role === 'system')?.content ?? '';
    const lastUser =
      [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';

    const contextMatch = system.match(
      /Контекст из базы знаний:\n([\s\S]*?)(?:\n\n|$)/,
    );
    const context = contextMatch?.[1]?.trim() ?? '';

    let response: string;
    if (context) {
      const snippet = context.slice(0, 400);
      response = `На основе информации с вашего сайта: ${snippet}${context.length > 400 ? '…' : ''} Если нужны детали — уточните вопрос.`;
    } else if (lastUser) {
      response = `Спасибо за вопрос! К сожалению, в базе знаний пока нет релевантных материалов по теме «${lastUser.slice(0, 80)}».`;
    } else {
      response = 'Здравствуйте! Чем могу помочь?';
    }

    const parts = response.split(/(\s+)/);
    for (const part of parts) {
      if (!part) continue;
      yield { content: part };
      await new Promise((r) => setTimeout(r, 15));
    }
    yield { content: '', done: true };
  }
}
