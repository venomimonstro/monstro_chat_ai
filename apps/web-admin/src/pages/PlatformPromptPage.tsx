import { useCallback, useEffect, useState } from 'react';
import type { PromptDto } from '@ai-consultant/shared-types';
import {
  activateGlobalPrompt,
  fetchActiveGlobalPrompt,
  fetchGlobalPromptHistory,
  saveGlobalPrompt,
} from '../lib/prompts';
import { extractApiError } from '../lib/api';

const CHAR_LIMIT = 8000;

const DEFAULT_HINT = `Ты — AI-консультант на сайте клиента. Общайся как живой менеджер.
Здесь владелец платформы задаёт глобальные правила для всех чатов:
- стиль общения и ограничения;
- что нельзя выдумывать (цены без KB, юр.условия);
- защита от prompt injection;
- правила сбора контактов.

Важно: в гибридном режиме агент НЕ должен отвечать «не знаю» на вопросы вне базы — он уточняет, помогает и ведёт к контакту.
Клиенты добавляют свой промпт в ЛК. База знаний (RAG) подставляется автоматически.`;

export function PlatformPromptPage() {
  const [content, setContent] = useState('');
  const [history, setHistory] = useState<PromptDto[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const reload = useCallback(async () => {
    const [active, versions] = await Promise.all([
      fetchActiveGlobalPrompt(),
      fetchGlobalPromptHistory(),
    ]);
    setHistory(versions);
    if (active?.content) {
      setContent(active.content);
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    reload()
      .then((hasActive) => {
        if (!hasActive) setContent(DEFAULT_HINT);
      })
      .catch((err) =>
        setError(extractApiError(err, 'Не удалось загрузить промпт')),
      );
  }, [reload]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveGlobalPrompt(content);
      setSaved(true);
      await reload();
    } catch (err) {
      setError(extractApiError(err, 'Не удалось сохранить'));
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async (id: string) => {
    setError(null);
    try {
      await activateGlobalPrompt(id);
      await reload();
      setSaved(true);
    } catch (err) {
      setError(extractApiError(err, 'Не удалось восстановить версию'));
    }
  };

  const chars = content.length;
  const overLimit = chars > CHAR_LIMIT;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Супер-промпт платформы</h1>
        <p className="mt-2 text-sm text-slate-400">
          Глобальные правила для всех AI-чатов. Порядок в API:{' '}
          <span className="text-slate-300">платформа → клиент → база знаний (RAG)</span>.
          Скрытых ограничений в коде нет — всё задаётся здесь.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <label className="mb-2 block text-sm font-medium text-slate-300">
          Активный глобальный промпт
        </label>
        <textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setSaved(false);
          }}
          rows={18}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-200 focus:border-brand-500 focus:outline-none"
          placeholder="Правила платформы для всех чатов…"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span className={overLimit ? 'text-red-400' : ''}>
            {chars} / {CHAR_LIMIT} символов
          </span>
          <span>~{Math.ceil(chars / 4)} токенов (оценка)</span>
        </div>
        <button
          type="button"
          disabled={saving || overLimit || !content.trim()}
          onClick={handleSave}
          className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
        >
          {saving ? 'Сохранение…' : 'Сохранить новую версию'}
        </button>
        {saved && (
          <p className="mt-2 text-sm text-green-400">Сохранено — активна новая версия</p>
        )}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-300">История версий</h2>
        {history.length === 0 ? (
          <p className="text-sm text-slate-500">Версий пока нет</p>
        ) : (
          <ul className="space-y-2">
            {history.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 px-3 py-2 text-sm"
              >
                <span className="text-slate-300">
                  v{p.version}
                  {p.isActive && (
                    <span className="ml-2 rounded bg-green-900/40 px-2 py-0.5 text-xs text-green-400">
                      активна
                    </span>
                  )}
                </span>
                <span className="text-xs text-slate-500">
                  {new Date(p.createdAt).toLocaleString('ru-RU')}
                </span>
                {!p.isActive && (
                  <button
                    type="button"
                    onClick={() => handleRestore(p.id)}
                    className="text-xs text-brand-400 hover:underline"
                  >
                    Восстановить
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 text-sm text-slate-400">
        <p className="font-medium text-slate-300">Оптимизация токенов</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>RAG обрезается до ~2800 символов на запрос</li>
          <li>Резюме диалога — до 400 символов</li>
          <li>Блок безопасности — 1 строка, только при подозрительных сообщениях</li>
          <li>Клиентский промпт в ЛК — отдельно, не дублируется</li>
        </ul>
      </div>
    </div>
  );
}
