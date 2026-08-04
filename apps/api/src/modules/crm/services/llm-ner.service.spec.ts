import { LlmNerService } from './llm-ner.service';
import { NerService } from './ner.service';

describe('LlmNerService', () => {
  const ner = new NerService();
  const service = new LlmNerService(ner);

  it('parses JSON entities from model output', () => {
    const parsed = service.parseJsonEntities(
      'Вот данные:\n{"phone":"+79991234567","email":"a@b.ru","name":"Иван Петров"}\n',
    );
    expect(parsed.phone).toBe('+79991234567');
    expect(parsed.email).toBe('a@b.ru');
    expect(parsed.name).toBe('Иван Петров');
  });

  it('merges regex and llm preferring filled fields', () => {
    const merged = service.merge(
      { phone: '+79991112233', email: null, name: null },
      { phone: null, email: 'x@y.ru', name: 'Анна' },
    );
    expect(merged).toEqual({
      phone: '+79991112233',
      email: 'x@y.ru',
      name: 'Анна',
    });
  });

  it('uses regex only when providers absent', async () => {
    const result = await service.extractHybrid('Мой телефон +79991234567');
    expect(result.phone).toBe('+79991234567');
  });
});
