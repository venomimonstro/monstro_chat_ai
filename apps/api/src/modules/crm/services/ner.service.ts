import { Injectable } from '@nestjs/common';

export interface ExtractedEntities {
  phone: string | null;
  email: string | null;
  name: string | null;
}

const PHONE_PATTERNS = [
  /(?:\+7|8)[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}/,
  /\+?\d{1,3}[\s\-]?\(?\d{2,4}\)?[\s\-]?\d{3}[\s\-]?\d{2,4}[\s\-]?\d{0,4}/,
];

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

const NAME_PATTERNS = [
  /(?:меня\s+зовут|мое\s+имя|зовут\s+меня)[,:]?\s+([А-ЯЁA-Z][а-яёa-z]+(?:\s+[А-ЯЁA-Z][а-яёa-z]+)?)/i,
  /(?:my name is|i am|i'm)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i,
];

@Injectable()
export class NerService {
  extract(text: string): ExtractedEntities {
    return {
      phone: this.extractPhone(text),
      email: this.extractEmail(text),
      name: this.extractName(text),
    };
  }

  extractPhone(text: string): string | null {
    for (const pattern of PHONE_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        return this.normalizePhone(match[0]);
      }
    }
    return null;
  }

  extractEmail(text: string): string | null {
    const match = text.match(EMAIL_PATTERN);
    return match ? match[0].toLowerCase() : null;
  }

  extractName(text: string): string | null {
    for (const pattern of NAME_PATTERNS) {
      const match = text.match(pattern);
      if (match?.[1]) {
        return match[1].trim();
      }
    }
    return null;
  }

  private normalizePhone(raw: string): string {
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('8')) {
      return `+7${digits.slice(1)}`;
    }
    if (digits.length === 11 && digits.startsWith('7')) {
      return `+${digits}`;
    }
    if (digits.length === 10) {
      return `+7${digits}`;
    }
    return raw.trim();
  }
}
