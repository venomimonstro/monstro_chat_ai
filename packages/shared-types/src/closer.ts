/** AI-closer: autonomous follow-up nudges (Sprint 66). */
export interface SourceCloserConfig {
  /** Enable timed follow-ups when visitor goes silent (default true). */
  enabled?: boolean;
  /** Minutes after last assistant reply before each follow-up attempt. */
  delaysMinutes?: number[];
  /** Max follow-up messages per dialog cycle (default 3). */
  maxAttempts?: number;
  /** Skip follow-ups when lead profile is complete (default true). */
  onlyIncompleteLeads?: boolean;
}

export const DEFAULT_CLOSER_DELAYS_MINUTES = [5, 60, 1440] as const;

export const DEFAULT_CLOSER_CONFIG: Required<SourceCloserConfig> = {
  enabled: true,
  delaysMinutes: [...DEFAULT_CLOSER_DELAYS_MINUTES],
  maxAttempts: 3,
  onlyIncompleteLeads: true,
};

export function resolveCloserConfig(
  closer?: SourceCloserConfig | null,
): Required<SourceCloserConfig> {
  const cfg = closer ?? {};
  return {
    enabled: cfg.enabled !== false,
    delaysMinutes:
      cfg.delaysMinutes?.length && cfg.delaysMinutes.every((n) => n > 0)
        ? cfg.delaysMinutes
        : [...DEFAULT_CLOSER_DELAYS_MINUTES],
    maxAttempts: Math.max(1, cfg.maxAttempts ?? DEFAULT_CLOSER_CONFIG.maxAttempts),
    onlyIncompleteLeads: cfg.onlyIncompleteLeads !== false,
  };
}

export function closerDelayMinutes(
  config: Required<SourceCloserConfig>,
  attemptIndex: number,
): number {
  const delays = config.delaysMinutes;
  if (attemptIndex < delays.length) return delays[attemptIndex];
  return delays[delays.length - 1] ?? 5;
}
