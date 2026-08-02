export type LlmProviderErrorCode =
  | 'invalid_key'
  | 'insufficient_balance'
  | 'rate_limit'
  | 'model_unavailable'
  | 'unknown';

export interface ParsedLlmProviderError {
  error: string;
  errorCode: LlmProviderErrorCode;
  hint?: string;
}

export function parseLlmProviderError(raw: string): ParsedLlmProviderError {
  const lower = raw.toLowerCase();

  if (
    lower.includes('401') ||
    lower.includes('invalid api key') ||
    lower.includes('invalid authentication') ||
    lower.includes('incorrect api key') ||
    lower.includes('unauthorized')
  ) {
    return {
      error: 'Невалидный API-ключ',
      errorCode: 'invalid_key',
      hint: 'Проверьте ключ в кабинете провайдера и сохраните заново',
    };
  }

  if (
    lower.includes('402') ||
    lower.includes('payment required') ||
    lower.includes('insufficient') ||
    lower.includes('credit') ||
    lower.includes('balance') ||
    lower.includes('quota') ||
    lower.includes('billing')
  ) {
    return {
      error: 'Недостаточно средств или исчерпан лимит',
      errorCode: 'insufficient_balance',
      hint: 'Пополните баланс у провайдера или выберите бесплатную модель (OpenRouter)',
    };
  }

  if (lower.includes('429') || lower.includes('rate limit') || lower.includes('too many')) {
    return {
      error: 'Превышен лимит запросов',
      errorCode: 'rate_limit',
      hint: 'Подождите несколько минут или переключите провайдера в цепочке',
    };
  }

  if (lower.includes('model') && (lower.includes('not found') || lower.includes('unavailable'))) {
    return {
      error: 'Модель недоступна для этого ключа',
      errorCode: 'model_unavailable',
      hint: 'Смените OPENROUTER_MODEL / модель провайдера на доступную',
    };
  }

  return {
    error: raw.length > 240 ? `${raw.slice(0, 240)}…` : raw,
    errorCode: 'unknown',
    hint: 'Смотрите полный текст ошибки в логах API',
  };
}
