import {
  closerDelayMinutes,
  resolveCloserConfig,
  DEFAULT_CLOSER_CONFIG,
} from './closer';

describe('resolveCloserConfig', () => {
  it('enables closer by default', () => {
    expect(resolveCloserConfig(undefined).enabled).toBe(true);
  });

  it('respects explicit disable', () => {
    expect(resolveCloserConfig({ enabled: false }).enabled).toBe(false);
  });

  it('uses default delays when invalid', () => {
    const cfg = resolveCloserConfig({ delaysMinutes: [0, -1] });
    expect(cfg.delaysMinutes).toEqual(DEFAULT_CLOSER_CONFIG.delaysMinutes);
  });

  it('returns delay by attempt index with fallback to last', () => {
    const cfg = resolveCloserConfig({ delaysMinutes: [5, 30] });
    expect(closerDelayMinutes(cfg, 0)).toBe(5);
    expect(closerDelayMinutes(cfg, 1)).toBe(30);
    expect(closerDelayMinutes(cfg, 5)).toBe(30);
  });
});
