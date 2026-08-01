import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../redis/redis.service';
import type {
  PublicSiteSettingsDto,
  UpdatePublicSiteSettingsDto,
} from '@ai-consultant/shared-types';

const REDIS_KEY = 'admin:public-site-settings';

export interface StoredSiteSettings {
  demoWidgetKey?: string;
  chatEnabled?: boolean;
  welcomeTitle?: string;
  welcomeText?: string;
}

@Injectable()
export class SiteSettingsService implements OnModuleInit {
  private cached: StoredSiteSettings = {};

  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    await this.refresh();
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
    };
  }

  async update(dto: UpdatePublicSiteSettingsDto): Promise<PublicSiteSettingsDto> {
    const client = this.redis.getClient();
    if (!client) {
      throw new Error('Redis unavailable');
    }

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
    };

    await client.set(REDIS_KEY, JSON.stringify(next));
    this.cached = next;
    return this.getPublicConfig();
  }
}
