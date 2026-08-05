import { evaluateAssertions } from './assertion-evaluator';

describe('evaluateAssertions', () => {
  it('passes when all mustContain match', () => {
    const result = evaluateAssertions('Здравствуйте! Мы доставляем по Москве.', {
      mustContain: ['доставляем', 'Москве'],
    });
    expect(result.passed).toBe(true);
    expect(result.failures).toHaveLength(0);
  });

  it('fails on missing mustContain', () => {
    const result = evaluateAssertions('Привет!', {
      mustContain: ['доставка'],
    });
    expect(result.passed).toBe(false);
    expect(result.failures[0]).toContain('доставка');
  });

  it('fails on forbidden phrase', () => {
    const result = evaluateAssertions('Передам оператору', {
      mustNotContain: ['оператор'],
    });
    expect(result.passed).toBe(false);
  });

  it('checks minLength', () => {
    const result = evaluateAssertions('Ок', { minLength: 10 });
    expect(result.passed).toBe(false);
    expect(result.failures[0]).toContain('10');
  });
});
