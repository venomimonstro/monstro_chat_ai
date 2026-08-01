import { calculateCostUsd } from './constants';

describe('calculateCostUsd', () => {
  it('calculates openai cost', () => {
    const cost = calculateCostUsd('openai', 1000, 500);
    expect(cost).toBeGreaterThan(0);
  });

  it('returns zero for mock provider', () => {
    expect(calculateCostUsd('mock', 1000, 1000)).toBe(0);
  });
});
