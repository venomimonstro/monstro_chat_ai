import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cheerio from 'cheerio';
import {
  parseRobots,
  type RobotsParserInstance,
} from '../utils/robots-parser.util';
import {
  normalizeCrawlUrl,
  resolveMaxDepth,
  scoreUrl,
  shouldSkipUrl,
  type CrawlStrategyOptions,
} from '../utils/crawl-strategy.util';

export interface CrawledPage {
  url: string;
  title: string;
  text: string;
}

export interface CrawlSiteOptions {
  pageLimit: number;
  maxDepth?: number;
  strategy: CrawlStrategyOptions;
}

interface QueueItem {
  url: string;
  depth: number;
  score: number;
}

@Injectable()
export class CrawlerService {
  private readonly logger = new Logger(CrawlerService.name);
  private readonly fetchTimeoutMs = 15_000;

  constructor(private readonly config: ConfigService) {}

  async fetchRobots(rootUrl: string): Promise<RobotsParserInstance> {
    const origin = new URL(rootUrl).origin;
    const robotsUrl = `${origin}/robots.txt`;

    try {
      const response = await this.fetchWithTimeout(
        this.preferInternalIfOwnSite(robotsUrl),
        robotsUrl,
      );
      if (!response.ok) {
        return parseRobots(robotsUrl, '');
      }
      const body = await response.text();
      return parseRobots(robotsUrl, body);
    } catch {
      return parseRobots(robotsUrl, '');
    }
  }

  isRootDisallowed(robots: RobotsParserInstance, rootUrl: string): boolean {
    const path = new URL(rootUrl).pathname || '/';
    const allowed =
      robots.isAllowed(rootUrl, '*') !== false ||
      robots.isAllowed(path, '*') !== false;
    return !allowed;
  }

  async crawlSite(
    rootUrl: string,
    options: CrawlSiteOptions,
    onPage?: (page: CrawledPage, processed: number, total: number) => Promise<void>,
  ): Promise<CrawledPage[]> {
    const normalizedRoot = normalizeCrawlUrl(rootUrl);
    const robots = await this.fetchRobots(normalizedRoot);

    if (this.isRootDisallowed(robots, normalizedRoot)) {
      throw new Error(
        'Сайт запрещает индексацию в robots.txt (Disallow: /)',
      );
    }

    const origin = new URL(normalizedRoot).origin;
    const maxDepth = options.maxDepth ?? resolveMaxDepth(options.strategy.siteProfile);
    const pageLimit = options.pageLimit;
    const visited = new Set<string>();
    const queue: QueueItem[] = [];

    const seedUrls = new Set<string>([normalizedRoot]);
    for (const priority of options.strategy.priorityUrls) {
      try {
        seedUrls.add(normalizeCrawlUrl(new URL(priority, normalizedRoot).href));
      } catch {
        /* skip invalid priority url */
      }
    }

    const sitemapUrls = await this.discoverSitemapUrls(normalizedRoot, robots);
    for (const url of sitemapUrls.slice(0, 300)) {
      if (this.isSameOrigin(url, origin)) seedUrls.add(url);
    }

    for (const url of seedUrls) {
      if (shouldSkipUrl(url, options.strategy)) continue;
      queue.push({ url, depth: 0, score: scoreUrl(url, options.strategy) + 1000 });
    }

    const pages: CrawledPage[] = [];
    let lastError: string | null = null;

    while (queue.length > 0 && pages.length < pageLimit) {
      queue.sort((a, b) => b.score - a.score);
      const current = queue.shift()!;
      const canonical = normalizeCrawlUrl(current.url);

      if (visited.has(canonical)) continue;
      if (shouldSkipUrl(canonical, options.strategy)) {
        visited.add(canonical);
        continue;
      }
      visited.add(canonical);

      const path = new URL(canonical).pathname || '/';
      if (
        robots.isAllowed(canonical, '*') === false &&
        robots.isAllowed(path, '*') === false
      ) {
        continue;
      }

      try {
        const page = await this.fetchPage(canonical);
        if (page.text.length > 0) {
          pages.push(page);
          if (onPage) {
            await onPage(page, pages.length, pageLimit);
          }
        } else {
          lastError = `Страница ${canonical} не содержит текста для индексации`;
        }

        if (current.depth < maxDepth) {
          const links = this.extractLinks(page.html, canonical);
          for (const link of links) {
            if (visited.has(link) || !this.isSameOrigin(link, origin)) continue;
            if (shouldSkipUrl(link, options.strategy)) continue;
            queue.push({
              url: link,
              depth: current.depth + 1,
              score: scoreUrl(link, options.strategy),
            });
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
          ? ' Проверьте CRAWL_INTERNAL_ORIGIN (для Docker: http://host.docker.internal:4321).'
          : '';
      throw new Error(
        (lastError
          ? `Не удалось проиндексировать сайт: ${lastError}`
          : 'Не удалось получить ни одной страницы. Проверьте URL, robots.txt и фильтры индексации.') +
          hint,
      );
    }

    return pages;
  }

  private async discoverSitemapUrls(
    rootUrl: string,
    robots: RobotsParserInstance,
  ): Promise<string[]> {
    const origin = new URL(rootUrl).origin;
    const candidates = new Set<string>([`${origin}/sitemap.xml`]);

    try {
      const robotsSitemaps = robots.getSitemaps?.() ?? [];
      for (const sm of robotsSitemaps) candidates.add(sm);
    } catch {
      /* ignore */
    }

    const urls: string[] = [];
    for (const sitemapUrl of candidates) {
      try {
        const response = await this.fetchWithTimeout(
          this.preferInternalIfOwnSite(sitemapUrl),
          sitemapUrl,
        );
        if (!response.ok) continue;
        const xml = await response.text();
        const matches = xml.matchAll(/<loc>([^<]+)<\/loc>/gi);
        for (const match of matches) {
          const loc = match[1]?.trim();
          if (loc) urls.push(normalizeCrawlUrl(loc));
        }
        if (urls.length) break;
      } catch {
        /* try next candidate */
      }
    }
    return urls;
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

  /** Fetch explicit URLs for prompt generation (no sitemap crawl). */
  async fetchPagesForPrompt(
    rawUrls: string[],
    maxPages = 5,
  ): Promise<{
    pages: CrawledPage[];
    errors: Array<{ url: string; error: string }>;
  }> {
    const pages: CrawledPage[] = [];
    const errors: Array<{ url: string; error: string }> = [];
    const seen = new Set<string>();

    for (const raw of rawUrls) {
      if (pages.length >= maxPages) break;

      const normalized = this.normalizePromptUrl(raw);
      if (!normalized) {
        errors.push({ url: raw.trim(), error: 'Некорректный URL' });
        continue;
      }
      if (seen.has(normalized)) continue;
      seen.add(normalized);

      try {
        const page = await this.fetchPage(normalized);
        pages.push({ url: page.url, title: page.title, text: page.text });
      } catch (err) {
        errors.push({
          url: raw.trim(),
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (!pages.length && errors.length) {
      throw new BadRequestException(
        errors[0]?.error ?? 'Не удалось загрузить страницы',
      );
    }

    return { pages, errors };
  }

  normalizePromptUrl(raw: string): string | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      const withProtocol = /^https?:\/\//i.test(trimmed)
        ? trimmed
        : `https://${trimmed}`;
      const parsed = new URL(withProtocol);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return null;
      }
      return normalizeCrawlUrl(parsed.href);
    } catch {
      return null;
    }
  }

  private async fetchPage(url: string): Promise<CrawledPage & { html: string }> {
    const fetchUrl = this.preferInternalIfOwnSite(url);
    const response = await this.fetchWithTimeout(fetchUrl, url);
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
        links.add(normalizeCrawlUrl(absolute));
      } catch {
        // skip invalid URLs
      }
    });

    return [...links];
  }

  private isSameOrigin(url: string, origin: string): boolean {
    try {
      return new URL(url).origin === origin;
    } catch {
      return false;
    }
  }

  private getConfiguredInternalOrigin(): string | null {
    return (
      this.config.get<string>('CRAWL_INTERNAL_ORIGIN') ??
      'http://host.docker.internal:4321'
    );
  }

  private isConfiguredInternalUrl(url: string): boolean {
    const internal = this.getConfiguredInternalOrigin();
    if (!internal) return false;
    try {
      return new URL(url).host === new URL(internal).host;
    } catch {
      return false;
    }
  }

  private getInternalFallbackUrl(url: string): string | null {
    const publicSite =
      this.config.get<string>('PUBLIC_SITE_URL') ??
      this.config.get<string>('STABILITY_PUBLIC_URL');
    const internal = this.getConfiguredInternalOrigin();
    if (!publicSite || !internal) return null;

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

  /** For own public site — crawl via Docker-internal origin first (avoids hairpin NAT). */
  private preferInternalIfOwnSite(url: string): string {
    return this.getInternalFallbackUrl(url) ?? url;
  }

  private isPrivateAddress(url: string): boolean {
    if (this.isConfiguredInternalUrl(url)) return false;
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

  private async fetchWithTimeout(
    url: string,
    originalUrl?: string,
  ): Promise<Response> {
    if (this.isPrivateAddress(url)) {
      throw new BadRequestException(
        'Crawling private/internal addresses is not allowed',
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.fetchTimeoutMs);
    const headers = { 'User-Agent': 'RedFlow-Crawler/2.0' };
    const publicUrl = originalUrl ?? url;

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers,
        redirect: 'follow',
      });
      if (response.ok) return response;

      const fallback = this.getInternalFallbackUrl(publicUrl);
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
      const fallback = this.getInternalFallbackUrl(publicUrl);
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
