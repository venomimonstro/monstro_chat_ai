import { NerService } from './ner.service';

describe('NerService', () => {
  let service: NerService;

  beforeEach(() => {
    service = new NerService();
  });

  it('extracts Russian phone numbers', () => {
    expect(service.extractPhone('Позвоните +7 (999) 123-45-67')).toBe(
      '+79991234567',
    );
  });

  it('extracts email', () => {
    expect(service.extractEmail('Пишите на test@example.com')).toBe(
      'test@example.com',
    );
  });

  it('extracts name from phrase', () => {
    expect(service.extractName('Меня зовут Иван Петров')).toBe('Иван Петров');
  });
});
