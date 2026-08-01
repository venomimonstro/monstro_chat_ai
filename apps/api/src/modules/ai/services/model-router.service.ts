import { Injectable } from '@nestjs/common';

export type ModelTier = 'cheap' | 'premium';

const PREMIUM_MARKERS = [
  /сравни/i,
  /анализ/i,
  /подробн/i,
  /разверн/i,
  /пошагов/i,
  /напиши код/i,
  /программир/i,
  /юридич/i,
  /контракт/i,
  /compare/i,
  /analyze/i,
  /detailed/i,
  /step.by.step/i,
  /explain in depth/i,
];

@Injectable()
export class ModelRouterService {
  classify(query: string, hasSimilarCache = false): ModelTier {
    const text = query.trim();
    if (!text) return 'cheap';

    if (hasSimilarCache) {
      return 'cheap';
    }

    if (PREMIUM_MARKERS.some((pattern) => pattern.test(text))) {
      return 'premium';
    }

    if (text.length > 300) {
      return 'premium';
    }

    if (text.length < 80) {
      return 'cheap';
    }

    const questionMarks = (text.match(/\?/g) ?? []).length;
    if (questionMarks >= 2) {
      return 'premium';
    }

    return 'cheap';
  }
}
