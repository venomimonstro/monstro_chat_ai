import { forwardRef, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ProviderRegistryService } from '../../ai/providers/provider-registry.service';
import type { ExtractedEntities } from './ner.service';
import { NerService } from './ner.service';

const EXTRACT_SYSTEM = [
  'Ты извлекаешь контактные данные из сообщения посетителя сайта.',
  'Верни ТОЛЬКО JSON без markdown: {"phone":string|null,"email":string|null,"name":string|null}',
  'phone — российский номер в формате +7XXXXXXXXXX если возможно.',
  'name — имя (и фамилия если есть). Не выдумывай данные.',
  'Если поля нет в тексте — null.',
].join(' ');

@Injectable()
export class LlmNerService {
  private readonly logger = new Logger(LlmNerService.name);

  constructor(
    private readonly ner: NerService,
    @Optional()
    @Inject(forwardRef(() => ProviderRegistryService))
    private readonly providers?: ProviderRegistryService,
  ) {}

  /**
   * Regex first; LLM only when payload looks promising but regex is incomplete.
   */
  async extractHybrid(
    text: string,
    needed: Array<'phone' | 'email' | 'name'> = ['phone', 'email', 'name'],
  ): Promise<ExtractedEntities> {
    const regex = this.ner.extract(text);
    const incomplete = needed.some((f) => !regex[f]);
    if (!incomplete || !this.providers) {
      return regex;
    }

    try {
      const llm = await this.extractViaLlm(text);
      return this.merge(regex, llm);
    } catch (err) {
      this.logger.debug(`LLM NER skipped: ${String(err)}`);
      return regex;
    }
  }

  merge(
    primary: ExtractedEntities,
    secondary: ExtractedEntities,
  ): ExtractedEntities {
    const name =
      [primary.name, secondary.name]
        .filter(Boolean)
        .sort((a, b) => (b?.length ?? 0) - (a?.length ?? 0))[0] ?? null;
    return {
      phone: primary.phone ?? secondary.phone,
      email: primary.email ?? secondary.email,
      name,
    };
  }

  private async extractViaLlm(text: string): Promise<ExtractedEntities> {
    const chain = this.providers!.getChain().filter((p) => p.name !== 'mock');
    const provider = chain[0] ?? this.providers!.getChain()[0];
    if (!provider) {
      return { phone: null, email: null, name: null };
    }

    let raw = '';
    for await (const token of provider.streamChat(
      [
        { role: 'system', content: EXTRACT_SYSTEM },
        { role: 'user', content: text.slice(0, 800) },
      ],
      { temperature: 0, maxTokens: 120 },
    )) {
      if (token.content) raw += token.content;
      if (token.done) break;
    }

    return this.parseJsonEntities(raw);
  }

  /** Exposed for unit tests. */
  parseJsonEntities(raw: string): ExtractedEntities {
    const empty = { phone: null, email: null, name: null };
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return empty;
    try {
      const parsed = JSON.parse(match[0]) as Record<string, unknown>;
      const phoneRaw =
        typeof parsed.phone === 'string' ? parsed.phone.trim() : '';
      const emailRaw =
        typeof parsed.email === 'string' ? parsed.email.trim() : '';
      const nameRaw = typeof parsed.name === 'string' ? parsed.name.trim() : '';

      // Re-normalize through regex helpers for consistency
      return {
        phone: phoneRaw ? this.ner.extractPhone(phoneRaw) ?? phoneRaw : null,
        email: emailRaw ? this.ner.extractEmail(emailRaw) ?? emailRaw.toLowerCase() : null,
        name: nameRaw || null,
      };
    } catch {
      return empty;
    }
  }
}
