import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseOpenAiCompatibleProvider } from './openai-compatible.base';

@Injectable()
export class DeepSeekProvider extends BaseOpenAiCompatibleProvider {
  readonly name = 'deepseek';
  readonly defaultModel: string;
  protected readonly baseUrl = 'https://api.deepseek.com/v1';

  constructor(config: ConfigService) {
    super();
    this._apiKey = config.get<string>('DEEPSEEK_API_KEY');
    this.defaultModel = config.get<string>(
      'DEEPSEEK_MODEL',
      'deepseek-chat',
    );
  }
}
