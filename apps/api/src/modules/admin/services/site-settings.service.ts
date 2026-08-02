import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../redis/redis.service';
import type {
  PublicSiteSettingsDto,
  UpdatePublicSiteSettingsDto,
} from '@ai-consultant/shared-types';

const REDIS_KEY = 'admin:public-site-settings';

const WIDGET_EMBED_MARKERS = [
  /AIConsultantWidget/i,
  /\baicw\s*\(\s*['"]init['"]/i,
];

function containsWidgetEmbed(html: string): boolean {
  const value = html?.trim();
  if (!value) return false;
  if (WIDGET_EMBED_MARKERS.some((pattern) => pattern.test(value))) return true;
  return /embed\.js/i.test(value) && /widgetKey/i.test(value);
}

function stripWidgetEmbed(html: string): string {
  if (!containsWidgetEmbed(html)) return html ?? '';
  return '';
}

export interface StoredSiteSettings {
  demoWidgetKey?: string;
  chatEnabled?: boolean;
  welcomeTitle?: string;
  welcomeText?: string;
  customHeadHtml?: string;
  customBodyStartHtml?: string;
  customBodyEndHtml?: string;
}

@Injectable()
export class SiteSettingsService implements OnModuleInit {
  private readonly logger = new Logger(SiteSettingsService.name);
  private cached: StoredSiteSettings = {};

  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    await this.refresh();
    await this.purgeWidgetEmbedFromCustomCode();
  }

  private async purgeWidgetEmbedFromCustomCode(): Promise<void> {
    const fields: Array<keyof Pick<StoredSiteSettings, 'customHeadHtml' | 'customBodyStartHtml' | 'customBodyEndHtml'>> = [
      'customHeadHtml',
      'customBodyStartHtml',
      'customBodyEndHtml',
    ];
    let dirty = false;
    const next = { ...this.cached };
    for (const field of fields) {
      const value = next[field];
      if (value && containsWidgetEmbed(value)) {
        this.logger.warn(
          `Removed AI widget embed code from custom ${field} — use «Чат и виджет» in admin`,
        );
        next[field] = '';
        dirty = true;
      }
    }
    if (!dirty) return;
    const client = this.redis.getClient();
    if (!client) return;
    await client.set(REDIS_KEY, JSON.stringify(next));
    this.cached = next;
  }

  async refresh(): Promise<StoredSiteSettings> {
    const client = this.redis.getClient();
    if (!client) {
      this.cached = {};
      return this.cached;
    }
    const raw = await client.get(REDIS_KEY);
    if (!raw) {
      this.cached = {};
      return this.cached;
    }
    try {
      this.cached = JSON.parse(raw) as StoredSiteSettings;
    } catch {
      this.cached = {};
    }
    return this.cached;
  }

  getPublicConfig(): PublicSiteSettingsDto {
    const envWidgetKey = this.config.get<string>('DEMO_WIDGET_KEY', '');
    const apiUrl = this.config.get<string>(
      'API_PUBLIC_URL',
      'http://localhost:3000/api',
    );
    const widgetUrl = this.config.get<string>(
      'WIDGET_URL',
      'http://localhost:5175',
    );

    const demoWidgetKey = this.cached.demoWidgetKey ?? envWidgetKey;
    const chatEnabled =
      this.cached.chatEnabled !== undefined
        ? this.cached.chatEnabled
        : Boolean(demoWidgetKey);

    return {
      demoWidgetKey,
      chatEnabled,
      welcomeTitle:
        this.cached.welcomeTitle ?? 'Попробуйте AI-консультанта',
      welcomeText:
        this.cached.welcomeText ??
        'Нажмите на кнопку чата в правом нижнем углу и задайте вопрос как посетитель вашего сайта.',
      apiUrl,
      widgetUrl,
      enabled: chatEnabled && Boolean(demoWidgetKey),
      customHeadHtml: this.cached.customHeadHtml ?? '',
      customBodyStartHtml: this.cached.customBodyStartHtml ?? '',
      customBodyEndHtml: this.cached.customBodyEndHtml ?? '',
    };
  }

  getPublicScripts() {
    const config = this.getPublicConfig();
    return {
      customHeadHtml: stripWidgetEmbed(config.customHeadHtml),
      customBodyStartHtml: stripWidgetEmbed(config.customBodyStartHtml),
      customBodyEndHtml: stripWidgetEmbed(config.customBodyEndHtml),
    };
  }

  getDemoWidgetConfig() {
    const config = this.getPublicConfig();
    return {
      demoWidgetKey: config.demoWidgetKey,
      chatEnabled: config.chatEnabled,
      welcomeTitle: config.welcomeTitle,
      welcomeText: config.welcomeText,
      apiUrl: config.apiUrl,
      widgetUrl: config.widgetUrl,
      enabled: config.enabled,
    };
  }

  private assertNoWidgetEmbed(field: string, html?: string): void {
    if (html !== undefined && containsWidgetEmbed(html)) {
      throw new BadRequestException(
        `В поле «${field}» нельзя вставлять код AI-виджета. Настройте чат во вкладке «Настройки сайта → Чат и виджет».`,
      );
    }
  }

  async update(dto: UpdatePublicSiteSettingsDto): Promise<PublicSiteSettingsDto> {
    const client = this.redis.getClient();
    if (!client) {
      throw new Error('Redis unavailable');
    }

    this.assertNoWidgetEmbed('head', dto.customHeadHtml);
    this.assertNoWidgetEmbed('body (начало)', dto.customBodyStartHtml);
    this.assertNoWidgetEmbed('body (конец)', dto.customBodyEndHtml);

    const next: StoredSiteSettings = {
      ...this.cached,
      ...(dto.demoWidgetKey !== undefined
        ? { demoWidgetKey: dto.demoWidgetKey.trim() }
        : {}),
      ...(dto.chatEnabled !== undefined ? { chatEnabled: dto.chatEnabled } : {}),
      ...(dto.welcomeTitle !== undefined
        ? { welcomeTitle: dto.welcomeTitle.trim() }
        : {}),
      ...(dto.welcomeText !== undefined
        ? { welcomeText: dto.welcomeText.trim() }
        : {}),
      ...(dto.customHeadHtml !== undefined
        ? { customHeadHtml: dto.customHeadHtml }
        : {}),
      ...(dto.customBodyStartHtml !== undefined
        ? { customBodyStartHtml: dto.customBodyStartHtml }
        : {}),
      ...(dto.customBodyEndHtml !== undefined
        ? { customBodyEndHtml: dto.customBodyEndHtml }
        : {}),
    };

    await client.set(REDIS_KEY, JSON.stringify(next));
    this.cached = next;
    return this.getPublicConfig();
  }
}
