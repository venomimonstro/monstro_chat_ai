import { buildKnowledgeModeInstruction } from './knowledge-mode.util';

describe('buildKnowledgeModeInstruction', () => {
  it('hybrid mode forbids bare refusal when RAG is empty', () => {
    const text = buildKnowledgeModeInstruction({
      mode: 'hybrid',
      ragSufficient: false,
      hasRagContext: false,
    });
    expect(text).toContain('AI-консультант');
    expect(text).toContain('НЕ отвечай');
    expect(text).toContain('пуста');
  });

  it('strict mode still avoids hard refusal', () => {
    const text = buildKnowledgeModeInstruction({
      mode: 'strict_kb',
      ragSufficient: false,
      hasRagContext: false,
    });
    expect(text).toContain('только база');
    expect(text).toContain('не знаю');
  });
});
