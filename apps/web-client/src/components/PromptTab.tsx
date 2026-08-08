import { useCallback, useEffect, useRef, useState } from 'react';
import type { PromptDto } from '@ai-consultant/shared-types';
import { PromptAbTestSection } from './PromptAbTestSection';
import {
  activatePrompt,
  fetchActivePrompt,
  fetchPromptCharLimit,
  fetchPromptHistory,
  generatePromptFromUrls,
  savePrompt,
  testPlayground,
} from '../lib/prompts';
import { extractErrorMessage } from '../lib/errors';

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
  const [urlInput, setUrlInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateInfo, setGenerateInfo] = useState<string | null>(null);

  const onPromptChangeRef = useRef(onPromptChange);
  onPromptChangeRef.current = onPromptChange;

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
      onPromptChangeRef.current(active.content);
    }
  }, []);

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

  const handleGenerateFromUrls = async () => {
    const urls = urlInput
      .split(/[\n,]+/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (!urls.length) {
      setGenerateError('Укажите хотя бы одну ссылку');
      return;
    }

    setGenerating(true);
    setGenerateError(null);
    setGenerateInfo(null);
    try {
      const res = await generatePromptFromUrls({ sourceId, urls });
      setContent(res.content);
      onPromptChangeRef.current(res.content);
      setSaved(false);
      const pageList = res.pages.map((p) => p.title || p.url).join(', ');
      const warn =
        res.errors.length > 0
          ? ` Не загружено: ${res.errors.map((e) => e.url).join(', ')}.`
          : '';
      setGenerateInfo(
        `Промпт создан по ${res.pages.length} стр.: ${pageList}.${warn} Проверьте текст и сохраните версию.`,
      );
    } catch (err) {
      setGenerateError(extractErrorMessage(err, 'Не удалось сгенерировать промпт'));
    } finally {
      setGenerating(false);
    }
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
        history: nextHistory.slice(0, -1),
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

        <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700">
            Сгенерировать из сайта
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Укажите ссылку на главную или несколько страниц — мы загрузим текст
            и составим черновик промпта. До 5 URL, по одному в строке.
          </p>
          <textarea
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            rows={3}
            placeholder={'https://example.com\nhttps://example.com/pricing'}
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleGenerateFromUrls}
              disabled={generating}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {generating ? 'Генерация…' : 'Сгенерировать промпт'}
            </button>
          </div>
          {generateError && (
            <p className="mt-2 text-xs text-red-600">{generateError}</p>
          )}
          {generateInfo && (
            <p className="mt-2 text-xs text-green-700">{generateInfo}</p>
          )}
        </div>

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
