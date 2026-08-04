import {
  detectsContactIntent,
  looksLikeContactPayload,
  shouldAskForContact,
} from './lead-timing.util';

describe('lead-timing.util', () => {
  it('detects price intent', () => {
    expect(detectsContactIntent('Сколько стоит подключение?')).toBe(true);
    expect(detectsContactIntent('привет')).toBe(false);
  });

  it('waits for min turns without intent', () => {
    const d = shouldAskForContact({
      userTurns: 1,
      askedRecently: false,
      lastUserMessage: 'Здравствуйте',
      missingCount: 1,
      askAfterTurns: 2,
    });
    expect(d.askNow).toBe(false);
    expect(d.reason).toBe('too_early');
  });

  it('asks on intent even before min turns', () => {
    const d = shouldAskForContact({
      userTurns: 1,
      askedRecently: false,
      lastUserMessage: 'Какая цена?',
      missingCount: 1,
      askAfterTurns: 2,
    });
    expect(d.askNow).toBe(true);
    expect(d.reason).toBe('intent');
  });

  it('skips ask if asked recently', () => {
    const d = shouldAskForContact({
      userTurns: 5,
      askedRecently: true,
      lastUserMessage: 'ок',
      missingCount: 1,
    });
    expect(d.askNow).toBe(false);
    expect(d.reason).toBe('asked_recently');
  });

  it('detects contact-like payloads', () => {
    expect(looksLikeContactPayload('89161234567')).toBe(true);
    expect(looksLikeContactPayload('привет')).toBe(false);
  });
});
