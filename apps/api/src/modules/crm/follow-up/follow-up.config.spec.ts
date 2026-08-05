import { resolveCloserConfig, closerDelayMinutes } from '@ai-consultant/shared-types';

describe('closer config (Sprint 66)', () => {
  it('enables closer by default', () => {
    expect(resolveCloserConfig(undefined).enabled).toBe(true);
  });

  it('picks delay by attempt with fallback', () => {
    const cfg = resolveCloserConfig({ delaysMinutes: [5, 30] });
    expect(closerDelayMinutes(cfg, 0)).toBe(5);
    expect(closerDelayMinutes(cfg, 3)).toBe(30);
  });
});
