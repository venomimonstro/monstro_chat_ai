import { useEffect, useState } from 'react';
import { extractErrorMessage } from '../lib/errors';
import { Link } from 'react-router-dom';
import { createSource, cloneSource, deleteSource, fetchSources, getEmbedCode, updateSource } from '../lib/sources';
import type { SourceDto } from '@ai-consultant/shared-types';
import { EmptyState, ErrorState, LoadingState } from '../components/EmptyState';
import { showToast } from '../components/Toast';
import { ChannelSetupPanel } from '../components/ChannelSetupPanel';
import type { SourceType } from '@ai-consultant/shared-types';

const WIDGET_SCRIPT_URL =
  import.meta.env.VITE_WIDGET_SCRIPT_URL ?? 'http://localhost:5175/embed.js';

export function SourcesPage() {
  const [sources, setSources] = useState<SourceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<SourceType>('website');
  const [error, setError] = useState('');
  const [installCode, setInstallCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setSources(await fetchSources());
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await createSource(newName, newType);
      setNewName('');
      setNewType('website');
      setShowAdd(false);
      await load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    }
  };

  const handleToggle = async (source: SourceDto) => {
    const status = source.status === 'active' ? 'inactive' : 'active';
    await updateSource(source.id, { status });
    await load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить источник?')) return;
    await deleteSource(id);
    await load();
  };

  const handleClone = async (id: string) => {
    try {
      await cloneSource(id);
      showToast('Копия источника создана', 'success');
      await load();
    } catch (err: unknown) {
      showToast(extractErrorMessage(err), 'error');
    }
  };

  const showInstall = (source: SourceDto) => {
    setInstallCode(getEmbedCode(source.widgetKey, WIDGET_SCRIPT_URL));
    setCopied(false);
  };

  const copyCode = async () => {
    if (!installCode) return;
    await navigator.clipboard.writeText(installCode);
    setCopied(true);
    showToast('Код установки скопирован', 'success');
  };

  if (loading) return <LoadingState message="Загрузка источников…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Источники</h1>
          <p className="mt-1 text-sm text-slate-500">Сайт, Telegram и ВКонтакте</p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          + Добавить
        </button>
      </div>

      {sources.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Нет источников"
            description="Добавьте «Чат на сайте», чтобы начать принимать обращения."
            action={
              <button
                type="button"
                onClick={() => setShowAdd(true)}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                Добавить источник
              </button>
            }
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          {sources.map((source) => (
            <div
              key={source.id}
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-slate-900">{source.name}</h2>
                  <p className="text-sm text-slate-500">
                    {source.type === 'website' ? 'Чат на сайте' : source.type === 'telegram' ? 'Telegram' : 'ВКонтакте'}
                    {source.scriptInstalledAt ? (
                      <span className="ml-2 inline-flex items-center gap-1 text-green-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        Скрипт установлен
                      </span>
                    ) : (
                      <span className="ml-2 inline-flex items-center gap-1 text-amber-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        Ожидает установки
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={source.status === 'active'}
                      onChange={() => handleToggle(source)}
                    />
                    Активен
                  </label>
                  {source.type === 'website' && (
                    <button
                      type="button"
                      onClick={() => showInstall(source)}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                    >
                      Код установки
                    </button>
                  )}
                  <Link
                    to={`/sources/${source.id}`}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                  >
                    Настройки
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleClone(source.id)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                  >
                    Клонировать
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(source.id)}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                  >
                    Удалить
                  </button>
                </div>
              </div>
              <ChannelSetupPanel source={source} onConnected={load} />
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold">Новый источник</h2>
            <form className="mt-4 space-y-4" onSubmit={handleCreate}>
              <div>
                <label className="block text-sm font-medium text-slate-700">Тип</label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as SourceType)}
                >
                  <option value="website">Чат на сайте</option>
                  <option value="telegram">Telegram</option>
                  <option value="vk">ВКонтакте</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Название</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Чат на главном сайте"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  required
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white"
                >
                  Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {installCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold">Код установки</h2>
            <p className="mt-1 text-sm text-slate-500">
              Вставьте этот код перед закрывающим тегом &lt;/body&gt;
            </p>
            <pre className="mt-4 max-h-64 overflow-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100">
              {installCode}
            </pre>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setInstallCode(null)}
                className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                Закрыть
              </button>
              <button
                type="button"
                onClick={copyCode}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white"
              >
                {copied ? 'Скопировано!' : 'Копировать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
