/** Keywords that signal buying / contact-ready intent. */
const INTENT_PATTERNS = [
  /цен[аыуе]/i,
  /стоимост/i,
  /тариф/i,
  /сколько\s+(стоит|будет)/i,
  /куп(ить|лю|им)/i,
  /заказ(ать|)/i,
  /заявк/i,
  /остав(лю|ить)\s+(номер|телефон|контакт)/i,
  /перезвон/i,
  /свяж(итесь|итесь)/i,
  /хочу\s+(подключ|оформ|запис)/i,
  /интересует/i,
  /прайс/i,
  /скидк/i,
  /договор/i,
];

export interface ContactAskDecision {
  /** Show ---contact--- block now. */
  askNow: boolean;
  reason: string;
}

export interface ContactAskInput {
  userTurns: number;
  /** Assistant already asked via ---contact--- in last N replies. */
  askedRecently: boolean;
  /** Latest user message. */
  lastUserMessage: string;
  /** Still missing required fields. */
  missingCount: number;
  /** Min user turns before first ask (default 2). */
  askAfterTurns?: number;
}

export function detectsContactIntent(text: string): boolean {
  if (!text?.trim()) return false;
  return INTENT_PATTERNS.some((p) => p.test(text));
}

/**
 * Smart timing: don't beg for a phone on the first greeting.
 * Ask when interest shows OR after N turns, and not every message.
 */
export function shouldAskForContact(input: ContactAskInput): ContactAskDecision {
  if (input.missingCount <= 0) {
    return { askNow: false, reason: 'complete' };
  }

  if (input.askedRecently) {
    return { askNow: false, reason: 'asked_recently' };
  }

  const minTurns = Math.max(1, input.askAfterTurns ?? 2);
  const intent = detectsContactIntent(input.lastUserMessage);

  if (intent) {
    return { askNow: true, reason: 'intent' };
  }

  if (input.userTurns >= minTurns) {
    return { askNow: true, reason: 'min_turns' };
  }

  return { askNow: false, reason: 'too_early' };
}

/** Message looks like it may contain contact data regex missed. */
export function looksLikeContactPayload(text: string): boolean {
  const digits = (text.match(/\d/g) ?? []).length;
  if (digits >= 7) return true;
  if (/@/.test(text)) return true;
  if (/(зовут|мое имя|my name|это)\s/i.test(text)) return true;
  return false;
}
