import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseOpenAiCompatibleProvider } from './openai-compatible.base';

@Injectable()
export class OpenRouterProvider extends BaseOpenAiCompatibleProvider {
  readonly name = 'openrouter';
  readonly defaultModel: string;
  protected readonly baseUrl = 'https://openrouter.ai/api/v1';
  private readonly siteUrl: string;
  private readonly siteName: string;

  constructor(config: ConfigService) {
    super();
    this._apiKey = config.get<string>('OPENROUTER_API_KEY');
    this.defaultModel = config.get<string>(
      'OPENROUTER_MODEL',
      'google/gemini-2.0-flash-001',
    );
    this.siteUrl = config.get<string>(
      'API_PUBLIC_URL',
      'http://localhost:3000/api',
    ).replace(/\/api\/?$/, '');
    this.siteName = config.get<string>('APP_NAME', 'AI-Консультант');
  }

  protected extraHeaders(): Record<string, string> {
    return {
      'HTTP-Referer': this.siteUrl,
      'X-Title': this.siteName,
    };
  }
}
