export const RAG_TOP_K = 5;
export const MAX_HISTORY_MESSAGES = 12;
export const HISTORY_SUMMARY_THRESHOLD = 15;
export const KEEP_RECENT_MESSAGES = 8;

export const WIDGET_RATE_LIMIT_MAX = 10;
export const WIDGET_RATE_LIMIT_WINDOW_MS = 60_000;

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
