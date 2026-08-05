import { useCallback, useEffect, useState } from 'react';
import type { PromptDto } from '@ai-consultant/shared-types';
import { PromptAbTestSection } from './PromptAbTestSection';
import { PromptRegressionSection } from './PromptRegressionSection';
import {
  activatePrompt,
  fetchActivePrompt,
  fetchPromptCharLimit,
  fetchPromptHistory,
  savePrompt,
  testPlayground,
} from '../lib/prompts';

interface SandboxMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function PromptTab({
  sourceId,
  initialPrompt,
  onPromptChange,
}: {
  sourceId: string;
  initialPrompt: string;
  onPromptChange: (prompt: string) => void;
}) {
  const [content, setContent] = useState(initialPrompt);
  const [charLimit, setCharLimit] = useState(4000);
  const [history, setHistory] = useState<PromptDto[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sandboxOpen, setSandboxOpen] = useState(false);
  const [sandboxInput, setSandboxInput] = useState('');
  const [sandboxMessages, setSandboxMessages] = useState<SandboxMessage[]>([]);
  const [sandboxLoading, setSandboxLoading] = useState(false);

  const reload = useCallback(async () => {
    const [active, versions, limit] = await Promise.all([
      fetchActivePrompt('tenant'),
      fetchPromptHistory('tenant'),
      fetchPromptCharLimit(),
    ]);
    setHistory(versions);
    setCharLimit(limit);
    if (active?.content) {
      setContent(active.content);
      onPromptChange(active.content);
    }
  }, [onPromptChange]);

  useEffect(() => {
    setContent(initialPrompt);
  }, [initialPrompt]);

  useEffect(() => {
    reload().catch(() => undefined);
  }, [reload]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await savePrompt(content, 'tenant');
      setSaved(true);
      onPromptChange(content);
      await reload();
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async (id: string) => {
    await activatePrompt(id);
    await reload();
    setSaved(true);
  };

  const handleSandboxSend = async () => {
    const text = sandboxInput.trim();
    if (!text) return;
    setSandboxInput('');
    const nextHistory = [...sandboxMessages, { role: 'user' as const, content: text }];
    setSandboxMessages(nextHistory);
    setSandboxLoading(true);
    try {
      const res = await testPlayground({
        sourceId,
        message: text,
        clientPrompt: content,
        history: sandboxMessages,
      });
      setSandboxMessages([
        ...nextHistory,
        { role: 'assistant', content: res.content },
      ]);
    } catch {
      setSandboxMessages([
        ...nextHistory,
        { role: 'assistant', content: 'Ошибка playground. Попробуйте позже.' },
      ]);
    } finally {
      setSandboxLoading(false);
    }
  };

  const charsLeft = charLimit - content.length;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            Промпт агента
          </h2>
          <span
            className={`text-xs ${charsLeft < 0 ? 'text-red-600' : 'text-slate-500'}`}
          >
            {content.length} / {charLimit}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Инструкции для ИИ-агента. Глобальные правила платформы имеют
          наивысший приоритет.
        </p>
        <textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setSaved(false);
          }}
          rows={10}
          className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="Например: Ты консультант интернет-магазина. Помогай с выбором товаров и доставкой."
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || charsLeft < 0}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? 'Сохранение...' : saved ? 'Сохранено ✓' : 'Сохранить версию'}
          </button>
          <button
            type="button"
            onClick={() => setSandboxOpen((v) => !v)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            {sandboxOpen ? 'Скрыть песочницу' : 'Проверить в песочнице'}
          </button>
        </div>
      </section>

      {sandboxOpen && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Песочница (без сохранения диалога)
          </h2>
          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto rounded-lg bg-slate-50 p-3 text-sm">
            {sandboxMessages.length === 0 && (
              <p className="text-slate-500">Отправьте тестовое сообщение</p>
            )}
            {sandboxMessages.map((msg, i) => (
              <div
                key={i}
                className={msg.role === 'user' ? 'text-right' : 'text-left'}
              >
                <span
                  className={`inline-block rounded-lg px-3 py-1.5 ${
                    msg.role === 'user'
                      ? 'bg-brand-600 text-white'
                      : 'bg-white border border-slate-200'
                  }`}
                >
                  {msg.content}
                </span>
              </div>
            ))}
            {sandboxLoading && (
              <p className="text-xs text-slate-500">Генерация ответа…</p>
            )}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={sandboxInput}
              onChange={(e) => setSandboxInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSandboxSend()}
              placeholder="Тестовое сообщение"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={handleSandboxSend}
              disabled={sandboxLoading}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              Отправить
            </button>
          </div>
        </section>
      )}

      {history.length > 0 && (
        <PromptAbTestSection history={history} />
      )}

      <PromptRegressionSection sourceId={sourceId} clientPrompt={content} />

      {history.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">
            История версий
          </h2>
          <ul className="mt-2 divide-y divide-slate-100 text-sm">
            {history.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between py-2"
              >
                <div>
                  <span className="font-medium">v{p.version}</span>
                  {p.isActive && (
                    <span className="ml-2 text-xs text-green-600">активна</span>
                  )}
                  <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                    {p.content.slice(0, 80)}…
                  </p>
                </div>
                {!p.isActive && (
                  <button
                    type="button"
                    onClick={() => handleRestore(p.id)}
                    className="text-xs text-brand-600 hover:underline"
                  >
                    Восстановить
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
