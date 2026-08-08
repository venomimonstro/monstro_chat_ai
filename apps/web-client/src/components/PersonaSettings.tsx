import type {
  ObjectionHandling,
  PersonaStyle,
} from '@ai-consultant/shared-types';
import {
  KNOWLEDGE_MODE_DESCRIPTIONS,
  KNOWLEDGE_MODE_LABELS,
  OBJECTION_HANDLING_LABELS,
  PERSONA_STYLE_DESCRIPTIONS,
  PERSONA_STYLE_LABELS,
  type KnowledgeMode,
} from '@ai-consultant/shared-types';

interface PersonaSettingsProps {
  knowledgeMode: KnowledgeMode;
  personaStyle: PersonaStyle;
  objectionHandling: ObjectionHandling;
  forbiddenPhrases: string[];
  onKnowledgeModeChange: (mode: KnowledgeMode) => void;
  onPersonaStyleChange: (style: PersonaStyle) => void;
  onObjectionHandlingChange: (mode: ObjectionHandling) => void;
  onForbiddenPhrasesChange: (phrases: string[]) => void;
}

const PERSONA_STYLES: PersonaStyle[] = [
  'friendly_pro',
  'warm_consultant',
  'expert',
  'sales_closer',
];

const OBJECTION_MODES: ObjectionHandling[] = [
  'balanced',
  'empathy_first',
  'value_focus',
];

const KNOWLEDGE_MODES: KnowledgeMode[] = ['hybrid', 'strict_kb'];

export function PersonaSettings({
  knowledgeMode,
  personaStyle,
  objectionHandling,
  forbiddenPhrases,
  onKnowledgeModeChange,
  onPersonaStyleChange,
  onObjectionHandlingChange,
  onForbiddenPhrasesChange,
}: PersonaSettingsProps) {
  const addForbidden = () => {
    onForbiddenPhrasesChange([...forbiddenPhrases, '']);
  };

  const updateForbidden = (index: number, value: string) => {
    const next = [...forbiddenPhrases];
    next[index] = value;
    onForbiddenPhrasesChange(next);
  };

  const removeForbidden = (index: number) => {
    const next = [...forbiddenPhrases];
    next.splice(index, 1);
    onForbiddenPhrasesChange(next);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Режим знаний</h2>
        <p className="mt-1 text-sm text-slate-500">
          Как агент использует базу знаний и нейросеть.
        </p>
      </div>

      <div className="grid gap-3">
        {KNOWLEDGE_MODES.map((mode) => (
          <label
            key={mode}
            className={`cursor-pointer rounded-xl border p-4 transition ${
              knowledgeMode === mode
                ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <input
              type="radio"
              name="knowledgeMode"
              value={mode}
              checked={knowledgeMode === mode}
              onChange={() => onKnowledgeModeChange(mode)}
              className="sr-only"
            />
            <span className="font-medium text-slate-900">
              {KNOWLEDGE_MODE_LABELS[mode]}
            </span>
            <p className="mt-1 text-sm text-slate-600">
              {KNOWLEDGE_MODE_DESCRIPTIONS[mode]}
            </p>
          </label>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-900">Стиль общения</h2>
        <p className="mt-1 text-sm text-slate-500">
          Агент общается автономно — как живой менеджер, без передачи оператору.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {PERSONA_STYLES.map((style) => (
          <label
            key={style}
            className={`cursor-pointer rounded-xl border p-4 transition ${
              personaStyle === style
                ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <input
              type="radio"
              name="personaStyle"
              value={style}
              checked={personaStyle === style}
              onChange={() => onPersonaStyleChange(style)}
              className="sr-only"
            />
            <span className="block text-sm font-medium text-slate-900">
              {PERSONA_STYLE_LABELS[style]}
            </span>
            <span className="mt-1 block text-xs text-slate-500">
              {PERSONA_STYLE_DESCRIPTIONS[style]}
            </span>
          </label>
        ))}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">
          Обработка возражений
        </label>
        <select
          value={objectionHandling}
          onChange={(e) =>
            onObjectionHandlingChange(e.target.value as ObjectionHandling)
          }
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          {OBJECTION_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {OBJECTION_HANDLING_LABELS[mode]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">
          Запрещённые фразы (дополнительно)
        </label>
        <p className="mt-1 text-xs text-slate-500">
          Базовый список уже включает «я бот», «передам менеджеру» и подобное.
        </p>
        <div className="mt-2 space-y-2">
          {forbiddenPhrases.map((phrase, index) => (
            <div key={index} className="flex gap-2">
              <input
                value={phrase}
                onChange={(e) => updateForbidden(index, e.target.value)}
                placeholder="Например: самый дешёвый"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => removeForbidden(index)}
                className="rounded-lg border border-red-200 px-3 text-sm text-red-600 hover:bg-red-50"
              >
                Удалить
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addForbidden}
            className="text-sm text-brand-600 hover:text-brand-700"
          >
            + Добавить фразу
          </button>
        </div>
      </div>
    </div>
  );
}
