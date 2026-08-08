/** Token-cost guards: keep system prompt compact. */
export const PROMPT_BUDGET = {
  RAG_CHARS: 2800,
  SUMMARY_CHARS: 400,
  LEAD_CHARS: 280,
  CLIENT_FALLBACK_CHARS: 4000,
  PERSONA_CHARS: 900,
  MODE_CHARS: 520,
} as const;

export function truncatePromptSection(text: string, maxChars: number): string {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxChars - 1))}…`;
}
