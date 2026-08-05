import {
  normalizeCrawlUrl,
  pathMatchesPattern,
  resolveEffectivePageLimit,
  resolveMaxDepth,
  scoreUrl,
  shouldSkipUrl,
} from './crawl-strategy.util';

const baseStrategy = {
  siteProfile: 'large' as const,
  excludeBlog: true,
  priorityUrls: ['https://example.com/pricing'],
  excludePatterns: ['/vacancy/*'],
};

describe('crawl-strategy.util', () => {
  it('normalizes trailing slashes', () => {
    expect(normalizeCrawlUrl('https://example.com/about/')).toBe(
      'https://example.com/about',
    );
  });

  it('skips blog paths when excludeBlog is true', () => {
    expect(
      shouldSkipUrl('https://example.com/blog/post-1', baseStrategy),
    ).toBe(true);
    expect(shouldSkipUrl('https://example.com/about', baseStrategy)).toBe(false);
  });

  it('matches glob exclude patterns', () => {
    expect(
      shouldSkipUrl('https://example.com/vacancy/dev', baseStrategy),
    ).toBe(true);
  });

  it('skips ecommerce pagination query params', () => {
    const ecommerce = { ...baseStrategy, siteProfile: 'ecommerce' as const };
    expect(
      shouldSkipUrl('https://shop.example.com/catalog?page=2', ecommerce),
    ).toBe(true);
  });

  it('scores priority urls higher', () => {
    const pricing = scoreUrl('https://example.com/pricing', baseStrategy);
    const blog = scoreUrl('https://example.com/blog/x', {
      ...baseStrategy,
      excludeBlog: false,
    });
    expect(pricing).toBeGreaterThan(blog);
  });

  it('pathMatchesPattern supports prefix and glob', () => {
    expect(pathMatchesPattern('/blog/post', '/blog')).toBe(true);
    expect(pathMatchesPattern('/vacancy/dev', '/vacancy/*')).toBe(true);
    expect(pathMatchesPattern('/about', '/blog')).toBe(false);
  });

  it('resolveEffectivePageLimit caps small sites', () => {
    expect(resolveEffectivePageLimit(500, 'small')).toBe(20);
    expect(resolveEffectivePageLimit(500, 'large')).toBe(500);
    expect(resolveEffectivePageLimit(500, 'auto', 10)).toBe(10);
  });

  it('resolveMaxDepth varies by profile', () => {
    expect(resolveMaxDepth('small')).toBe(5);
    expect(resolveMaxDepth('ecommerce')).toBe(3);
  });
});
