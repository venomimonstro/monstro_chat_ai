import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cheerio from 'cheerio';
import robotsParser from 'robots-parser';
import { CRAWL_MAX_DEPTH } from '../constants';

export interface CrawledPage {
  url: string;
  title: string;
  text: string;
}

@Injectable()
export class CrawlerService {
  private readonly logger = new Logger(CrawlerService.name);
  private readonly fetchTimeoutMs = 15_000;

  constructor(private readonly config: ConfigService) {}

  async fetchRobots(rootUrl: string): Promise<ReturnType<typeof robotsParser>> {
    const origin = new URL(rootUrl).origin;
    const robotsUrl = `${origin}/robots.txt`;

    try {
      const response = await this.fetchWithTimeout(robotsUrl);
      if (!response.ok) {
        return robotsParser(robotsUrl, '');
      }
      const body = await response.text();
      return robotsParser(robotsUrl, body);
    } catch {
      return robotsParser(robotsUrl, '');
    }
  }

  isRootDisallowed(robots: ReturnType<typeof robotsParser>, rootUrl: string): boolean {
    const path = new URL(rootUrl).pathname || '/';
    return !robots.isAllowed(rootUrl, '*') && !robots.isAllowed(path, '*');
  }

  async crawlSite(
    rootUrl: string,
    pageLimit: number,
    onPage?: (page: CrawledPage, processed: number, total: number) => Promise<void>,
  ): Promise<CrawledPage[]> {
    const normalizedRoot = this.normalizeUrl(rootUrl);
    const robots = await this.fetchRobots(normalizedRoot);

    if (this.isRootDisallowed(robots, normalizedRoot)) {
      throw new Error(
        'Сайт запрещает индексацию в robots.txt (Disallow: /)',
      );
    }

    const origin = new URL(normalizedRoot).origin;
    const visited = new Set<string>();
    const queue: Array<{ url: string; depth: number }> = [
      { url: normalizedRoot, depth: 0 },
    ];
    const pages: CrawledPage[] = [];
    let lastError: string | null = null;

    while (queue.length > 0 && pages.length < pageLimit) {
      const current = queue.shift()!;
      const canonical = this.normalizeUrl(current.url);

      if (visited.has(canonical)) continue;
      visited.add(canonical);

      const path = new URL(canonical).pathname || '/';
      if (!robots.isAllowed(canonical, '*') && !robots.isAllowed(path, '*')) {
        continue;
      }

      try {
        const page = await this.fetchPage(canonical);
        if (page.text.length > 0) {
          pages.push(page);
          if (onPage) {
            await onPage(page, pages.length, Math.min(pageLimit, visited.size));
          }
        } else {
          lastError = `Страница ${canonical} не содержит текста для индексации`;
        }

        if (current.depth < CRAWL_MAX_DEPTH) {
          const links = this.extractLinks(page.html, canonical);
          for (const link of links) {
            if (!visited.has(link) && this.isSameOrigin(link, origin)) {
              queue.push({ url: link, depth: current.depth + 1 });
            }
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        lastError = message;
        this.logger.warn(`Failed to crawl ${canonical}: ${message}`);
      }
    }

    if (pages.length === 0) {
      const hint =
        this.getInternalFallbackUrl(normalizedRoot) != null
          ? ' API в Docker: попробуйте тот же путь через внутренний адрес или проверьте CRAWL_INTERNAL_ORIGIN.'
          : '';
      throw new Error(
        (lastError
          ? `Не удалось проиндексировать сайт: ${lastError}`
          : 'Не удалось получить ни одной страницы. Проверьте URL и доступность сайта с сервера API.') +
          hint,
      );
    }

    return pages;
  }

  extractTextFromHtml(html: string): { title: string; text: string; html: string } {
    const $ = cheerio.load(html);
    $('script, style, noscript, iframe, svg').remove();
    $('nav, footer, header, [role="navigation"], [aria-hidden="true"]').remove();

    const title = $('title').first().text().trim() || 'Без названия';

    const mainSelectors = ['main', 'article', '[role="main"]', '#content', '.content'];
    let text = '';
    for (const selector of mainSelectors) {
      const chunk = $(selector).first().text().replace(/\s+/g, ' ').trim();
      if (chunk.length > text.length) text = chunk;
    }
    if (text.length < 120) {
      text = $('body').text().replace(/\s+/g, ' ').trim();
    }

    return { title, text, html };
  }

  private async fetchPage(url: string): Promise<CrawledPage & { html: string }> {
    const response = await this.fetchWithTimeout(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (
      !contentType.includes('text/html') &&
      !contentType.includes('application/xhtml')
    ) {
      throw new Error('Not HTML');
    }

    const html = await response.text();
    const { title, text } = this.extractTextFromHtml(html);
    return { url, title, text, html };
  }

  private extractLinks(html: string, baseUrl: string): string[] {
    const $ = cheerio.load(html);
    const links = new Set<string>();

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:')) return;
      try {
        const absolute = new URL(href, baseUrl).href;
        links.add(this.normalizeUrl(absolute));
      } catch {
        // skip invalid URLs
      }
    });

    return [...links];
  }

  private normalizeUrl(url: string): string {
    const parsed = new URL(url);
    parsed.hash = '';
    if (parsed.pathname.endsWith('/') && parsed.pathname.length > 1) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.href;
  }

  private isSameOrigin(url: string, origin: string): boolean {
    try {
      return new URL(url).origin === origin;
    } catch {
      return false;
    }
  }

  private getInternalFallbackUrl(url: string): string | null {
    const publicSite =
      this.config.get<string>('PUBLIC_SITE_URL') ??
      this.config.get<string>('STABILITY_PUBLIC_URL');
    const internal =
      this.config.get<string>('CRAWL_INTERNAL_ORIGIN') ??
      'http://host.docker.internal:4321';
    if (!publicSite) return null;

    try {
      const target = new URL(url);
      const pub = new URL(publicSite);
      if (target.host !== pub.host) return null;
      const internalBase = new URL(internal);
      target.protocol = internalBase.protocol;
      target.host = internalBase.host;
      return target.href;
    } catch {
      return null;
    }
  }

  private isPrivateAddress(url: string): boolean {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase();
      if (hostname === 'localhost' || hostname.endsWith('.local')) return true;
      if (hostname === 'host.docker.internal') return false;
      if (hostname.startsWith('127.') || hostname === '0.0.0.0') return true;
      if (hostname.startsWith('10.') || hostname.startsWith('192.168.')) return true;
      if (hostname.startsWith('172.')) {
        const second = parseInt(hostname.split('.')[1], 10);
        if (second >= 16 && second <= 31) return true;
      }
      if (hostname.startsWith('169.254.')) return true;
      if (hostname.startsWith('fc00:') || hostname.startsWith('fe80:')) return true;
      return false;
    } catch {
      return true;
    }
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    if (this.isPrivateAddress(url)) {
      throw new BadRequestException('Crawling private/internal addresses is not allowed');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.fetchTimeoutMs);
    const headers = { 'User-Agent': 'AI-Consultant-Crawler/1.0' };

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers,
        redirect: 'follow',
      });
      if (response.ok) return response;

      const fallback = this.getInternalFallbackUrl(url);
      if (fallback && fallback !== url) {
        this.logger.log(`Retry crawl via internal origin: ${fallback}`);
        return await fetch(fallback, {
          signal: controller.signal,
          headers,
          redirect: 'follow',
        });
      }
      return response;
    } catch (error) {
      const fallback = this.getInternalFallbackUrl(url);
      if (fallback && fallback !== url) {
        this.logger.log(`Retry crawl via internal origin after error: ${fallback}`);
        return await fetch(fallback, {
          signal: controller.signal,
          headers,
          redirect: 'follow',
        });
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
