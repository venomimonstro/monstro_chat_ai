import { useEffect, useState } from 'react';
import { fetchSiteSettings, updateSiteSettings } from '../lib/api';
import { EmptyState, ErrorState, LoadingState } from '../components/UiState';

export function SiteCodePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [headHtml, setHeadHtml] = useState('');
  const [bodyStartHtml, setBodyStartHtml] = useState('');
  const [bodyEndHtml, setBodyEndHtml] = useState('');

  const load = () => {
    setLoading(true);
    setError(null);
    fetchSiteSettings()
      .then((data) => {
        setHeadHtml(data.customHeadHtml ?? '');
        setBodyStartHtml(data.customBodyStartHtml ?? '');
        setBodyEndHtml(data.customBodyEndHtml ?? '');
      })
      .catch(() => setError('Не удалось загрузить настройки'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await updateSiteSettings({
        customHeadHtml: headHtml,
        customBodyStartHtml: bodyStartHtml,
        customBodyEndHtml: bodyEndHtml,
      });
      setMessage('Код сохранён. Обновите публичный сайт (Ctrl+F5) — скрипты подключатся сразу');
    } catch {
      setMessage('Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState message="Загрузка…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="max-w-3xl space-y-6">
      {message && (
        <p className="rounded-lg border border-emerald-800/40 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-300">
          {message}
        </p>
      )}

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-lg font-semibold text-slate-100">Произвольный код</h2>
        <p className="mt-1 text-sm text-slate-400">
          Вставьте HTML/JS для чата (Jivo, Carrot quest), аналитики, пикселей и любых других
          скриптов. Код применяется только к публичному сайту.
        </p>

        <label className="mt-4 block">
          <span className="text-sm font-medium text-slate-300">&lt;head&gt; — перед закрытием</span>
          <textarea
            value={headHtml}
            onChange={(e) => setHeadHtml(e.target.value)}
            rows={6}
            placeholder={'<script>...</script>\n<meta ...>'}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-200"
          />
        </label>

        <label className="mt-4 block">
          <span className="text-sm font-medium text-slate-300">
            Начало &lt;body&gt; — сразу после открытия
          </span>
          <textarea
            value={bodyStartHtml}
            onChange={(e) => setBodyStartHtml(e.target.value)}
            rows={5}
            placeholder={'<!-- GTM noscript -->\n<script>...</script>'}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-200"
          />
        </label>

        <label className="mt-4 block">
          <span className="text-sm font-medium text-slate-300">
            Конец &lt;body&gt; / футер — перед закрытием body
          </span>
          <textarea
            value={bodyEndHtml}
            onChange={(e) => setBodyEndHtml(e.target.value)}
            rows={6}
            placeholder={'<script src="..."></script>'}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-200"
          />
        </label>

        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="mt-6 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
        >
          {saving ? 'Сохранение…' : 'Сохранить код'}
        </button>
      </section>

      <EmptyState
        title="Пример: виджет Jivo"
        description={'Вставьте в «Конец body» скрипт из личного кабинета Jivo. Наш виджет AI и внешний чат могут работать одновременно.'}
      />
    </div>
  );
}
