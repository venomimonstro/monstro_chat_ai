import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { CrawlerService } from '../knowledge/services/crawler.service';
import { ProviderRegistryService } from '../ai/providers/provider-registry.service';
import { PromptsService } from './prompts.service';
import { truncatePromptSection } from '../ai/utils/prompt-budget.util';
import type { ChatMessage } from '../ai/providers/llm-provider.interface';

const GENERATION_SYSTEM = [
  'Ты составляешь промпт для AI-консультанта на сайте компании.',
  'На вход — тексты страниц сайта. На выход — ТОЛЬКО текст промпта на русском, без пояснений и markdown-обёрток.',
  '',
  'Структура промпта:',
  '1) Роль и цель консультанта',
  '2) Кратко о компании/продукте — только факты из материалов',
  '3) Стиль общения (язык, тон, длина ответов)',
  '4) Как вести диалог (уточнять задачу, связывать с выгодой)',
  '5) Если точного факта нет — уточни вопрос, предложи близкую информацию и мягко попроси контакт; не отвечай одной фразой «не знаю»',
  '6) Мягкая конверсия (заявка, звонок, форма)',
  '7) Запреты: не выдумывать цены, функции, гарантии и юридические условия',
  '',
  'Не включай блок [База знаний] — она подставляется автоматически.',
  'Не упоминай, что ты языковая модель.',
].join('\n');

const MAX_PAGES = 5;
const PAGE_TEXT_CHARS = 2200;
const SOURCE_TEXT_CHARS = 7000;

@Injectable()
export class PromptGenerationService {
  private readonly dailyLimit: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly crawler: CrawlerService,
    private readonly providers: ProviderRegistryService,
    private readonly prompts: PromptsService,
    config: ConfigService,
  ) {
    this.dailyLimit = config.get<number>('PROMPT_GEN_DAILY_LIMIT', 30);
  }

  async generateFromUrls(params: {
    tenantId: string;
    sourceId: string;
    urls: string[];
  }) {
    const urls = params.urls.map((u) => u.trim()).filter(Boolean);
    if (!urls.length) {
      throw new BadRequestException('Укажите хотя бы одну ссылку');
    }
    if (urls.length > MAX_PAGES) {
      throw new BadRequestException(`Максимум ${MAX_PAGES} ссылок за раз`);
    }

    await this.assertQuota(params.tenantId);

    const source = await this.prisma.source.findFirst({
      where: { id: params.sourceId, tenantId: params.tenantId },
    });
    if (!source) throw new NotFoundException('Источник не найден');

    const { pages, errors } = await this.crawler.fetchPagesForPrompt(
      urls,
      MAX_PAGES,
    );
    if (!pages.length) {
      throw new BadRequestException('Не удалось извлечь текст ни с одной страницы');
    }

    const charLimit = await this.prompts.getPromptCharLimit(params.tenantId);
    const siteContext = this.buildSiteContext(pages);
    const userMessage = [
      `Компания / источник: ${source.name}`,
      `Лимит промпта: ${charLimit} символов. Уложись в лимит.`,
      '',
      'Материалы страниц:',
      siteContext,
    ].join('\n');

    const messages: ChatMessage[] = [
      { role: 'system', content: GENERATION_SYSTEM },
      { role: 'user', content: userMessage },
    ];

    const chain = this.providers.getChain().filter((p) => p.name !== 'mock');
    const providers = chain.length ? chain : this.providers.getChain();

    let fullResponse = '';
    let usedProvider = providers[providers.length - 1];
    let usedModel = usedProvider.defaultModel;

    for (const provider of providers) {
      try {
        usedProvider = provider;
        usedModel = provider.defaultModel;
        fullResponse = '';
        for await (const token of provider.streamChat(messages, {
          temperature: 0.4,
          maxTokens: Math.min(2000, Math.ceil(charLimit / 2)),
        })) {
          if (token.content) fullResponse += token.content;
          if (token.done) break;
        }
        if (fullResponse.trim()) break;
      } catch {
        fullResponse = '';
      }
    }

    if (!fullResponse.trim()) {
      throw new BadRequestException(
        'Не удалось сгенерировать промпт. Проверьте настройки LLM-провайдера.',
      );
    }

    const content = truncatePromptSection(
      this.stripMarkdownWrapper(fullResponse),
      charLimit,
    );

    return {
      content,
      charLimit,
      provider: usedProvider.name,
      model: usedModel,
      pages: pages.map((p) => ({ url: p.url, title: p.title })),
      errors,
    };
  }

  private buildSiteContext(
    pages: Array<{ url: string; title: string; text: string }>,
  ): string {
    const chunks = pages.map((page) => {
      const text = page.text.trim().slice(0, PAGE_TEXT_CHARS);
      return `URL: ${page.url}\nЗаголовок: ${page.title}\nТекст:\n${text}`;
    });
    return truncatePromptSection(chunks.join('\n\n---\n\n'), SOURCE_TEXT_CHARS);
  }

  private stripMarkdownWrapper(text: string): string {
    let result = text.trim();
    if (result.startsWith('```')) {
      result = result.replace(/^```[\w-]*\n?/, '').replace(/\n?```$/, '');
    }
    return result.trim();
  }

  private async assertQuota(tenantId: string) {
    const client = this.redis.getClient();
    if (!client) return;

    const key = `prompt-gen:${tenantId}:${new Date().toISOString().slice(0, 10)}`;
    const count = await client.incr(key);
    if (count === 1) {
      await client.expire(key, 86400);
    }
    if (count > this.dailyLimit) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'PROMPT_GEN_LIMIT_EXCEEDED',
        message: 'Дневной лимит генерации промптов исчерпан',
      });
    }
  }
}
