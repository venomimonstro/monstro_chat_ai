import { useEffect, useState } from 'react';
import {
  fetchDiagnosticsLink,
  regenerateDiagnosticsLink,
} from '../lib/api';
import type { DiagnosticsLinkDto } from '@ai-consultant/shared-types';
import { ErrorState, LoadingState } from '../components/UiState';

export function SiteDiagnosticsPage() {
  const [link, setLink] = useState<DiagnosticsLinkDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setLink(await fetchDiagnosticsLink());
    } catch {
      setError('Не удалось получить диагностическую ссылку');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const regenerate = async () => {
    setRegenerating(true);
    try {
      setLink(await regenerateDiagnosticsLink());
    } catch {
      setError('Не удалось обновить ссылку');
    } finally {
      setRegenerating(false);
    }
  };

  const copy = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value).catch(() => undefined);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) return <LoadingState message="Загрузка…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!link) return null;

  return (
    <div className="max-w-3xl space-y-6">
      <section className="rounded-xl border border-brand-500/30 bg-brand-950/20 p-5">
        <h2 className="text-lg font-semibold text-slate-100">Ссылка для диагностики</h2>
        <p className="mt-1 text-sm text-slate-400">
          Отправьте эту ссылку поддержке или агенту — без входа в админку видно, что работает,
          а что нет (API, ЛК, админка, чат, публичный сайт).
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <p className="text-xs text-slate-500">Страница (удобно для человека)</p>
            <div className="mt-1 flex flex-wrap gap-2">
              <code className="flex-1 break-all rounded-lg bg-slate-950 px-3 py-2 text-xs text-emerald-300">
                {link.pageUrl}
              </code>
              <button
                type="button"
                onClick={() => copy(link.pageUrl, 'page')}
                className="rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-300"
              >
                {copied === 'page' ? 'Скопировано' : 'Копировать'}
              </button>
              <a
                href={link.pageUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-brand-600 px-3 py-2 text-xs text-white"
              >
                Открыть
              </a>
            </div>
          </div>

          <div>
            <p className="text-xs text-slate-500">JSON API (для автоматизации)</p>
            <div className="mt-1 flex flex-wrap gap-2">
              <code className="flex-1 break-all rounded-lg bg-slate-950 px-3 py-2 text-xs text-slate-300">
                {link.apiUrl}
              </code>
              <button
                type="button"
                onClick={() => copy(link.apiUrl, 'api')}
                className="rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-300"
              >
                {copied === 'api' ? 'Скопировано' : 'Копировать'}
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          disabled={regenerating}
          onClick={regenerate}
          className="mt-4 rounded-lg border border-amber-700/50 px-4 py-2 text-sm text-amber-200 hover:bg-amber-950/30 disabled:opacity-50"
        >
          {regenerating ? 'Обновляем…' : 'Сгенерировать новую ссылку'}
        </button>
        <p className="mt-2 text-xs text-slate-500">
          После регенерации старая ссылка перестанет работать.
        </p>
      </section>
    </div>
  );
}
