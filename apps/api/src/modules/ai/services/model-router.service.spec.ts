import { ModelRouterService } from './model-router.service';

describe('ModelRouterService', () => {
  const service = new ModelRouterService();

  it('routes short simple questions to cheap tier', () => {
    expect(service.classify('Сколько стоит доставка?')).toBe('cheap');
    expect(service.classify('Привет')).toBe('cheap');
  });

  it('routes complex analysis requests to premium tier', () => {
    expect(
      service.classify('Сделай подробный анализ конкурентов и сравни цены'),
    ).toBe('premium');
  });

  it('routes long questions to premium tier', () => {
    const longQuestion = 'а'.repeat(350);
    expect(service.classify(longQuestion)).toBe('premium');
  });
});
