/** Профиль сайта для стратегии индексации (Sprint 68). */
export type CrawlSiteProfile = 'auto' | 'small' | 'large' | 'ecommerce';

export interface SourceTrainingConfig {
  /** Корневой URL для индексации (сохраняется между сессиями). */
  crawlRootUrl?: string;
  /** auto — определить по sitemap/объёму; small — до ~20 стр.; large — приоритет ключевых; ecommerce — каталог без мусора. */
  siteProfile?: CrawlSiteProfile;
  /** Исключать типичные блог/новости/теги из индексации. */
  excludeBlog?: boolean;
  /** URL, которые клиент считает важными — индексируются первыми. */
  priorityUrls?: string[];
  /** Доп. glob-паттерны исключения (например /vacancy/*). */
  excludePatterns?: string[];
}

export const DEFAULT_EXCLUDE_PATH_PATTERNS = [
  '/blog',
  '/news',
  '/tag',
  '/tags',
  '/author',
  '/category',
  '/cart',
  '/checkout',
  '/basket',
  '/account',
  '/login',
  '/register',
  '/search',
  '/wishlist',
  '/compare',
] as const;

export const DEFAULT_PRIORITY_PATH_HINTS = [
  '/',
  '/pricing',
  '/price',
  '/tariff',
  '/tariffs',
  '/services',
  '/service',
  '/about',
  '/contacts',
  '/contact',
  '/faq',
  '/help',
  '/catalog',
  '/products',
] as const;

export function resolveTrainingConfig(
  training?: SourceTrainingConfig | null,
): Required<
  Pick<SourceTrainingConfig, 'siteProfile' | 'excludeBlog'> & {
    priorityUrls: string[];
    excludePatterns: string[];
  }
> {
  return {
    siteProfile: training?.siteProfile ?? 'auto',
    excludeBlog: training?.excludeBlog !== false,
    priorityUrls: training?.priorityUrls?.filter(Boolean) ?? [],
    excludePatterns: training?.excludePatterns?.filter(Boolean) ?? [],
  };
}
