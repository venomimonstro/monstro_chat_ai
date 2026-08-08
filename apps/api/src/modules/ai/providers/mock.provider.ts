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
    const history = messages.filter(
      (m) => m.role === 'user' || m.role === 'assistant',
    );
    const lastUser =
      [...history].reverse().find((m) => m.role === 'user')?.content ?? '';

    const kbMatch = system.match(
      /\[Материалы из базы знаний[\s\S]*?\]\n([\s\S]*?)(?:\n\n\[|$)/,
    );
    const softMatch = system.match(
      /\[Возможно релевантные материалы[\s\S]*?\]\n([\s\S]*?)(?:\n\n\[|$)/,
    );
    const legacyMatch = system.match(
      /Контекст из базы знаний:\n([\s\S]*?)(?:\n\n|$)/,
    );
    const context =
      kbMatch?.[1]?.trim() ||
      softMatch?.[1]?.trim() ||
      legacyMatch?.[1]?.trim() ||
      '';

    const cleanedContext = context.replace(/^\[\d+\]\s*/, '').trim();

    let response: string;
    if (cleanedContext && !cleanedContext.startsWith('[')) {
      const snippet = cleanedContext.slice(0, 500);
      response =
        `Понял ваш вопрос. По материалам компании: ${snippet}${cleanedContext.length > 500 ? '…' : ''} ` +
        `Если нужны детали — уточните, что именно вас интересует, и я помогу разобраться.`;
    } else if (lastUser) {
      response =
        `Спасибо за вопрос! Чтобы ответить точно, уточните, пожалуйста: ` +
        `что именно вас интересует в теме «${lastUser.slice(0, 80)}»? ` +
        `Могу также записать ваш контакт — команда перезвонит с подробностями.`;
    } else {
      response =
        'Здравствуйте! Расскажите, чем могу помочь — отвечу по делу и подскажу лучший вариант.';
    }

    const parts = response.split(/(\s+)/);
    for (const part of parts) {
      if (!part) continue;
      yield { content: part };
      await new Promise((r) => setTimeout(r, 12));
    }
    yield { content: '', done: true };
  }
}
