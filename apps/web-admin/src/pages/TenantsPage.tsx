import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { TenantListItemDto, TenantStatus } from '@ai-consultant/shared-types';
import {
  bulkBlockTenants,
  downloadTenantsCsv,
  fetchAdminTenants,
} from '../lib/api';
import { EmptyState, ErrorState, LoadingState, StatusBadge } from '../components/UiState';

function formatRub(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value);
}

const statusLabels: Record<string, string> = {
  active: 'Активен',
  suspended: 'Заблокирован',
  trial_expired: 'Триал истёк',
  trialing: 'Пробный период',
};

const statusColors: Record<string, string> = {
  active: 'bg-emerald-900/50 text-emerald-300',
  suspended: 'bg-red-900/50 text-red-300',
  trial_expired: 'bg-amber-900/50 text-amber-300',
  trialing: 'bg-blue-900/50 text-blue-300',
};

export function TenantsPage() {
  const [data, setData] = useState<{
    items: TenantListItemDto[];
    total: number;
    page: number;
    limit: number;
  } | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<TenantStatus | ''>('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [blocking, setBlocking] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    fetchAdminTenants({
      page,
      limit: 20,
      search: search || undefined,
      status: status || undefined,
    })
      .then(setData)
      .catch(() => setError('Не удалось загрузить список клиентов'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [page, status]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (!data) return;
    if (selected.size === data.items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(data.items.map((t) => t.id)));
    }
  };

  const bulkSuspend = async () => {
    if (selected.size === 0) return;
    const reason = prompt(`Причина блокировки ${selected.size} клиент(ов):`);
    if (!reason || reason.trim().length < 3) return;
    setBlocking(true);
    try {
      await bulkBlockTenants([...selected], reason.trim());
      setSelected(new Set());
      load();
    } catch {
      setError('Не удалось заблокировать выбранных клиентов');
    } finally {
      setBlocking(false);
    }
  };

  const exportCsv = () => {
    downloadTenantsCsv({
      search: search || undefined,
      status: status || undefined,
    });
  };

  if (loading) return <LoadingState message="Загрузка клиентов…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data || data.items.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Клиенты</h1>
        <p className="mt-1 text-slate-400">Управление тенантами платформы</p>
        <div className="mt-6">
          <EmptyState
            title="Клиенты не найдены"
            description="По заданным фильтрам нет тенантов."
          />
        </div>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(data.total / data.limit));

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-100">Клиенты</h1>
      <p className="mt-1 text-slate-400">Управление тенантами платформы</p>

      <div className="mt-6 flex flex-wrap gap-3">
        <input
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          placeholder="Поиск по названию"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (setPage(1), load())}
        />
        <select
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as TenantStatus | '');
            setPage(1);
          }}
        >
          <option value="">Все статусы</option>
          <option value="active">Активен</option>
          <option value="suspended">Заблокирован</option>
          <option value="trial_expired">Триал истёк</option>
          <option value="trialing">Пробный период</option>
        </select>
        <button
          type="button"
          onClick={() => {
            setPage(1);
            load();
          }}
          className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
        >
          Найти
        </button>
        <button
          type="button"
          onClick={exportCsv}
          className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
        >
          Экспорт CSV
        </button>
      </div>

      {selected.size > 0 && (
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-2 text-sm">
          <span className="text-red-200">Выбрано: {selected.size}</span>
          <button
            type="button"
            disabled={blocking}
            onClick={bulkSuspend}
            className="rounded-lg bg-red-700 px-3 py-1 text-xs text-white disabled:opacity-50"
          >
            {blocking ? 'Блокировка…' : 'Заблокировать'}
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-red-300 hover:underline"
          >
            Снять выделение
          </button>
        </div>
      )}

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-800 bg-slate-900/80 text-slate-400">
            <tr>
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={selected.size === data.items.length}
                  onChange={toggleAll}
                  aria-label="Выбрать все"
                />
              </th>
              <th className="px-4 py-3">Компания</th>
              <th className="px-4 py-3">Статус</th>
              <th className="px-4 py-3">Тариф</th>
              <th className="px-4 py-3">Баланс</th>
              <th className="px-4 py-3">Владелец</th>
              <th className="px-4 py-3 text-right">Действия</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((tenant) => (
              <tr
                key={tenant.id}
                className="border-b border-slate-800/80 transition hover:bg-slate-900/50"
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(tenant.id)}
                    onChange={() => toggle(tenant.id)}
                    aria-label={`Выбрать ${tenant.name}`}
                  />
                </td>
                <td className="px-4 py-3 font-medium text-slate-100">
                  {tenant.name}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge
                    status={tenant.status}
                    labels={statusLabels}
                    colors={statusColors}
                  />
                </td>
                <td className="px-4 py-3 text-slate-300">{tenant.tariffName ?? '—'}</td>
                <td className="px-4 py-3 text-slate-300">{formatRub(tenant.balance)}</td>
                <td className="px-4 py-3 text-slate-400">
                  {tenant.ownerEmail ?? '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    to={`/tenants/${tenant.id}`}
                    className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
                  >
                    Детали
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
          Стр. {page} из {totalPages} ({data.total} всего)
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
