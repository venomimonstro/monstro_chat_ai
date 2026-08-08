import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CrawlerService } from './crawler.service';

function mockRobots(rules: { allowRoot: boolean }) {
  return {
    isAllowed: () => rules.allowRoot,
    getSitemaps: () => [],
  };
}

describe('CrawlerService', () => {
  let service: CrawlerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrawlerService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
      ],
    }).compile();
    service = module.get(CrawlerService);
  });

  it('detects root disallowed by robots.txt', () => {
    const robots = mockRobots({ allowRoot: false });
    expect(service.isRootDisallowed(robots, 'https://example.com/')).toBe(
      true,
    );
  });

  it('allows root when robots permits', () => {
    const robots = mockRobots({ allowRoot: true });
    expect(service.isRootDisallowed(robots, 'https://example.com/')).toBe(
      false,
    );
  });

  it('extracts text from HTML', () => {
    const html =
      '<html><head><title>Test Page</title></head><body><p>Hello</p><script>bad()</script></body></html>';
    const result = service.extractTextFromHtml(html);
    expect(result.title).toBe('Test Page');
    expect(result.text).toContain('Hello');
    expect(result.text).not.toContain('bad()');
  });

  it('maps public site URL to internal origin for self-crawl', async () => {
    const module = await Test.createTestingModule({
      providers: [
        CrawlerService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'PUBLIC_SITE_URL') return 'https://redflow.ru';
              if (key === 'CRAWL_INTERNAL_ORIGIN')
                return 'http://host.docker.internal:4321';
              return undefined;
            },
          },
        },
      ],
    }).compile();
    const svc = module.get(CrawlerService);
    const internal = (
      svc as unknown as {
        getInternalFallbackUrl: (u: string) => string | null;
      }
    ).getInternalFallbackUrl('https://redflow.ru/pricing');
    expect(internal).toBe('http://host.docker.internal:4321/pricing');
  });
});
