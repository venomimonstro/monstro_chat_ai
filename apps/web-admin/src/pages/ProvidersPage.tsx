import { useEffect, useState } from 'react';
import {
  fetchAdminProviders,
  updateAdminProviders,
  type LlmProviderInfo,
} from '../lib/api';
import { EmptyState, ErrorState, LoadingState } from '../components/UiState';

export function ProvidersPage() {
  const [providers, setProviders] = useState<LlmProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    fetchAdminProviders()
      .then(setProviders)
      .catch(() => setError('Не удалось загрузить провайдеры'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const persist = async (next: LlmProviderInfo[]) => {
    setSaving(true);
    setMessage(null);
    try {
      const chain = next.map((p) => p.name);
      const disabled = next.filter((p) => !p.enabled).map((p) => p.name);
      const updated = await updateAdminProviders({ chain, disabled });
      setProviders(updated);
      setMessage('Конфигурация сохранена');
    } catch {
      setMessage('Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= providers.length) return;
    const next = [...providers];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    setProviders(next.map((p, i) => ({ ...p, priority: i + 1 })));
    persist(next);
  };

  const toggle = (name: string) => {
    const next = providers.map((p) =>
      p.name === name ? { ...p, enabled: !p.enabled } : p,
    );
    setProviders(next);
    persist(next);
  };

  if (loading) return <LoadingState message="Загрузка провайдеров…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">LLM-провайдеры</h1>
        <p className="mt-1 text-sm text-slate-400">
          Приоритет fallback-цепочки, включение и статус ключей API
        </p>
        {message && (
          <p className="mt-2 text-sm text-emerald-400">{message}</p>
        )}
      </div>

      {providers.length === 0 ? (
        <EmptyState
          title="Провайдеры не настроены"
          description="Проверьте переменные окружения API (OPENAI_API_KEY и др.)."
        />
      ) : (
        <div className="space-y-3">
          {providers.map((provider, index) => (
            <div
              key={provider.name}
              className="rounded-xl border border-slate-800 bg-slate-900 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">#{provider.priority}</span>
                    <h2 className="text-lg font-semibold capitalize text-slate-100">
                      {provider.name}
                    </h2>
                  </div>
                  <p className="mt-1 text-sm text-slate-400">
                    Модель: {provider.defaultModel}
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    API key: {provider.apiKeyMasked ?? '—'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Pill
                    label={provider.available ? 'Ключ OK' : 'Нет ключа'}
                    ok={provider.available}
                  />
                  <Pill
                    label={provider.enabled ? 'Включён' : 'Выключен'}
                    ok={provider.enabled}
                  />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving || index === 0}
                  onClick={() => move(index, -1)}
                  className="rounded-lg border border-slate-600 px-3 py-1 text-xs text-slate-300 disabled:opacity-40"
                >
                  ↑ Выше
                </button>
                <button
                  type="button"
                  disabled={saving || index === providers.length - 1}
                  onClick={() => move(index, 1)}
                  className="rounded-lg border border-slate-600 px-3 py-1 text-xs text-slate-300 disabled:opacity-40"
                >
                  ↓ Ниже
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => toggle(provider.name)}
                  className="rounded-lg border border-slate-600 px-3 py-1 text-xs text-slate-300"
                >
                  {provider.enabled ? 'Отключить' : 'Включить'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Pill({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
        ok ? 'bg-emerald-900/50 text-emerald-300' : 'bg-amber-900/50 text-amber-300'
      }`}
    >
      {label}
    </span>
  );
}
