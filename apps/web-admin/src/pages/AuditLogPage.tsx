import { useEffect, useState } from 'react';
import type { AuditLogDto } from '@ai-consultant/shared-types';
import { fetchAuditLogs } from '../lib/api';
import { EmptyState, ErrorState, LoadingState, StatusBadge } from '../components/UiState';

const actionLabels: Record<string, string> = {
  'tenant.block': 'Блокировка',
  'tenant.unblock': 'Разблокировка',
  'tenant.balance_adjustment': 'Баланс',
  'tenant.tariff_change': 'Тариф',
  'tenant.impersonate': 'Impersonation',
  'tenant.password_reset': 'Сброс пароля',
};

const actionColors: Record<string, string> = {
  'tenant.block': 'bg-red-900/50 text-red-300',
  'tenant.unblock': 'bg-emerald-900/50 text-emerald-300',
  'tenant.balance_adjustment': 'bg-amber-900/50 text-amber-300',
  'tenant.tariff_change': 'bg-blue-900/50 text-blue-300',
  'tenant.impersonate': 'bg-purple-900/50 text-purple-300',
  'tenant.password_reset': 'bg-slate-800 text-slate-300',
};

function JsonBlock({ value }: { value: Record<string, unknown> | null }) {
  if (!value) return <span className="text-slate-500">—</span>;
  return (
    <pre className="max-h-40 overflow-auto rounded bg-slate-950 p-2 text-xs text-slate-300">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function AuditLogPage() {
  const [items, setItems] = useState<AuditLogDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAuditLogs({
        page,
        limit: 20,
        action: action || undefined,
        search: search || undefined,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch {
      setError('Не удалось загрузить аудит-лог');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page, action, search]);

  const totalPages = Math.max(1, Math.ceil(total / 20));

  if (loading) return <LoadingState message="Загрузка аудит-лога…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-100">Аудит-лог</h1>
      <p className="mt-1 text-slate-400">
        Неизменяемый журнал административных действий
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <input
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          placeholder="Поиск по email или причине"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Все действия</option>
          <option value="tenant.block">Блокировка</option>
          <option value="tenant.unblock">Разблокировка</option>
          <option value="tenant.balance_adjustment">Баланс</option>
          <option value="tenant.tariff_change">Тариф</option>
          <option value="tenant.impersonate">Impersonation</option>
          <option value="tenant.password_reset">Сброс пароля</option>
        </select>
      </div>

      {items.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="Записи не найдены"
            description="По выбранному фильтру нет событий. Измените фильтр или выполните административное действие."
          />
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {items.map((row) => (
            <div
              key={row.id}
              className="rounded-xl border border-slate-800 bg-slate-900 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="flex items-center gap-2 font-medium text-slate-100">
                    <StatusBadge status={row.action} labels={actionLabels} colors={actionColors} />
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    {row.actorEmail} ·{' '}
                    {new Date(row.createdAt).toLocaleString('ru-RU')}
                  </p>
                  {row.reason && (
                    <p className="mt-1 text-sm text-amber-200">
                      Причина: {row.reason}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setExpandedId(expandedId === row.id ? null : row.id)
                  }
                  className="text-sm text-brand-400 hover:text-brand-300"
                >
                  {expandedId === row.id ? 'Скрыть diff' : 'Показать diff'}
                </button>
              </div>
              {expandedId === row.id && (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="mb-1 text-xs text-slate-500">До</p>
                    <JsonBlock value={row.beforeJson} />
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-slate-500">После</p>
                    <JsonBlock value={row.afterJson} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center gap-3 text-sm text-slate-400">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
          className="rounded-lg border border-slate-700 px-3 py-1.5 disabled:opacity-40 hover:bg-slate-800"
        >
          ← Назад
        </button>
        <span>
          Стр. {page} из {totalPages} ({total} всего)
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
          className="rounded-lg border border-slate-700 px-3 py-1.5 disabled:opacity-40 hover:bg-slate-800"
        >
          Вперёд →
        </button>
      </div>
    </div>
  );
}
