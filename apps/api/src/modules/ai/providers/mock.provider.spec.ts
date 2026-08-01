import { MockLLMProvider } from './mock.provider';
import type { ChatMessage } from './llm-provider.interface';

describe('MockLLMProvider', () => {
  let provider: MockLLMProvider;

  beforeEach(() => {
    provider = new MockLLMProvider();
  });

  it('streams response using RAG context from system prompt', async () => {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          'Контекст из базы знаний:\n[1] Доставка бесплатна от 5000 рублей',
      },
      { role: 'user', content: 'Сколько стоит доставка?' },
    ];

    let full = '';
    for await (const token of provider.streamChat(messages)) {
      full += token.content;
    }

    expect(full).toContain('Доставка бесплатна');
  });

  it('is always available', () => {
    expect(provider.isAvailable()).toBe(true);
  });
});
