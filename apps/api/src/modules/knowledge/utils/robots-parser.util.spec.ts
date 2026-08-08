import { parseRobots } from './robots-parser.util';

describe('parseRobots', () => {
  it('parses robots.txt and allows root', () => {
    const robots = parseRobots(
      'https://example.com/robots.txt',
      'User-agent: *\nAllow: /',
    );
    expect(robots.isAllowed('https://example.com/', '*')).not.toBe(false);
  });

  it('blocks disallowed paths', () => {
    const robots = parseRobots(
      'https://example.com/robots.txt',
      'User-agent: *\nDisallow: /',
    );
    expect(robots.isAllowed('https://example.com/', '*')).toBe(false);
  });
});
