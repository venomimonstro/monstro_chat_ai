import type { KnowledgeMode } from '@ai-consultant/shared-types';
import { PROMPT_BUDGET, truncatePromptSection } from './prompt-budget.util';

export function buildKnowledgeModeInstruction(params: {
  mode: KnowledgeMode;
  ragSufficient: boolean;
  hasRagContext: boolean;
}): string {
  const { mode, ragSufficient, hasRagContext } = params;

  if (mode === 'strict_kb') {
    return truncatePromptSection(
      [
        '[Режим: только база знаний]',
        'Факты (цены, сроки, условия) — только из блока [База знаний].',
        'Если точного факта нет: не выдумывай; кратко скажи, что уточнишь детали, задай 1 уточняющий вопрос или попроси контакт.',
        'Не заканчивай ответ одной фразой «не знаю» / «нет информации».',
      ].join('\n'),
      PROMPT_BUDGET.MODE_CHARS,
    );
  }

  const lines = [
    '[Режим: AI-консультант]',
    'Ты продающий консультант, а не FAQ-бот. Нейросеть ведёт диалог; материалы из базы — источник точных фактов.',
    'Если вопрос не покрыт базой: НЕ отвечай «не знаю», «нет информации», «не могу помочь».',
    'Вместо отказа: уточни задачу; расскажи близкое из материалов; предложи варианты; мягко попроси контакт для точного ответа.',
    'Цены, сроки, гарантии и юр.условия — только из базы/промпта, без выдумок.',
  ];

  if (!hasRagContext) {
    lines.push(
      'База знаний пуста или без совпадения — опирайся на промпт клиента и веди диалог как менеджер.',
    );
  } else if (!ragSufficient) {
    lines.push(
      'Релевантность базы низкая — используй материалы осторожно, больше уточняй и веди к контакту.',
    );
  }

  return truncatePromptSection(lines.join('\n'), PROMPT_BUDGET.MODE_CHARS);
}
