import { describe, expect, it } from 'vitest';
import { parseAssistantMessage } from './messageContent';

describe('parseAssistantMessage', () => {
  it('splits explicit contact block', () => {
    const result = parseAssistantMessage(
      'Тариф Start — от 2990 ₽.\n\n---contact---\nОставьте телефон, и мы поможем с подключением.\n---end---',
    );
    expect(result.body).toContain('Тариф Start');
    expect(result.contactPrompt).toContain('телефон');
  });

  it('hides contact block while streaming incomplete markers', () => {
    const result = parseAssistantMessage(
      'Ответ на вопрос.\n\n---contact---\nОставьте телефон',
      true,
    );
    expect(result.contactPrompt).toBeNull();
    expect(result.body).toContain('Ответ на вопрос');
  });

  it('detects heuristic contact paragraph', () => {
    const result = parseAssistantMessage(
      'Мы работаем по будням с 9 до 18.\n\nОставьте, пожалуйста, номер телефона для связи.',
    );
    expect(result.contactPrompt).toContain('телефона');
    expect(result.body).toContain('будням');
  });
});
