import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseOpenAiCompatibleProvider } from './openai-compatible.base';

@Injectable()
export class OpenAIProvider extends BaseOpenAiCompatibleProvider {
  readonly name = 'openai';
  readonly defaultModel: string;
  protected readonly baseUrl = 'https://api.openai.com/v1';

  constructor(config: ConfigService) {
    super();
    this._apiKey = config.get<string>('OPENAI_API_KEY');
    this.defaultModel = config.get<string>('OPENAI_MODEL', 'gpt-4o-mini');
  }
}
