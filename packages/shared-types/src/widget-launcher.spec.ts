import { describe, expect, it } from '@jest/globals';
import { isWidgetActiveOnPage, pathMatchesWidgetPattern } from './widget-launcher';

describe('widget-launcher page rules', () => {
  it('matches glob patterns', () => {
    expect(pathMatchesWidgetPattern('/catalog/item-1', '/catalog/*')).toBe(true);
    expect(pathMatchesWidgetPattern('/about', '/catalog/*')).toBe(false);
  });

  it('include mode shows only matching pages', () => {
    expect(
      isWidgetActiveOnPage('/pricing', {
        mode: 'include',
        patterns: ['/pricing', '/contacts'],
      }),
    ).toBe(true);
    expect(
      isWidgetActiveOnPage('/blog/post', {
        mode: 'include',
        patterns: ['/pricing'],
      }),
    ).toBe(false);
  });

  it('exclude mode hides matching pages', () => {
    expect(
      isWidgetActiveOnPage('/blog/post', {
        mode: 'exclude',
        patterns: ['/blog/*'],
      }),
    ).toBe(false);
    expect(
      isWidgetActiveOnPage('/pricing', {
        mode: 'exclude',
        patterns: ['/blog/*'],
      }),
    ).toBe(true);
  });
});
