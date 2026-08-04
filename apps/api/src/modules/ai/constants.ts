/** @deprecated Prefer env RAG_TOP_K via RetrievalService; kept for callers. */
export const RAG_TOP_K = 5;
export const DEFAULT_RAG_TOP_K = 5;
/** Wider pool before rerank + threshold filter. */
export const DEFAULT_RAG_CANDIDATE_K = 15;
/** Min cosine similarity (1 - distance) to keep a chunk. */
export const DEFAULT_RAG_SIMILARITY_THRESHOLD = 0.72;

export const INSUFFICIENT_RAG_CONTEXT =
  '[Недостаточно релевантного контекста в базе знаний. ' +
  'Не выдумывай факты. Честно скажи, что точной информации по этому вопросу нет в материалах, ' +
  'предложи уточнить детали или оставить контакт — команда перезвонит с точным ответом. ' +
  'Не предлагай передать диалог оператору.]';
export const MAX_HISTORY_MESSAGES = 12;
export const HISTORY_SUMMARY_THRESHOLD = 15;
export const KEEP_RECENT_MESSAGES = 8;

export const WIDGET_RATE_LIMIT_MAX = 8;
export const WIDGET_RATE_LIMIT_WINDOW_MS = 60_000;
export const WIDGET_IP_RATE_LIMIT_MAX = 40;
export const WIDGET_MAX_MESSAGE_LENGTH = 2000;
export const WIDGET_DUPLICATE_WINDOW_MS = 30_000;
export const WIDGET_DUPLICATE_MAX = 3;

export const PROVIDER_COST_PER_1K: Record<
  string,
  { input: number; output: number }
> = {
  openai: { input: 0.00015, output: 0.0006 },
  deepseek: { input: 0.00007, output: 0.00028 },
  anthropic: { input: 0.00025, output: 0.00125 },
  openrouter: { input: 0, output: 0 },
  mock: { input: 0, output: 0 },
};

export function calculateCostUsd(
  provider: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const rates = PROVIDER_COST_PER_1K[provider] ?? PROVIDER_COST_PER_1K.mock;
  return (
    (promptTokens / 1000) * rates.input +
    (completionTokens / 1000) * rates.output
  );
}
