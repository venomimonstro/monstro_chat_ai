import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchPlatformAnalyticsSummary, fetchSystemHealth, type AdminSystemHealth } from '../lib/api';
import { localDateRange } from '../lib/dates';
import { ErrorState, LoadingState } from '../components/UiState';

export function DashboardPage() {
  const [health, setHealth] = useState<AdminSystemHealth | null>(null);
  const [summary, setSummary] = useState<
    import('@ai-consultant/shared-types').PlatformAnalyticsSummaryDto | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    const range = localDateRange(30);
    Promise.all([
      fetchSystemHealth(),
      fetchPlatformAnalyticsSummary(range.from, range.to).catch(() => null),
    ])
      .then(([healthData, summaryData]) => {
        setHealth(healthData);
        setSummary(summaryData);
      })
      .catch(() => setError('Не удалось загрузить статус системы'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <LoadingState message="Загрузка статуса…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-100">Панель администратора</h1>
      <p className="mt-2 text-slate-400">
        Управление клиентами, тарифами, провайдерами и инфраструктурой
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickCard to="/tenants" label="Клиенты" description="Управление тенантами" />
        <QuickCard to="/tariffs" label="Тарифы" description="CRUD тарифов" />
        <QuickCard to="/providers" label="LLM" description="Провайдеры и fallback" />
        <QuickCard to="/analytics" label="Аналитика" description="Дашборды и метрики" />
      </div>

      {summary && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Выручка (30д)" value={`${summary.revenueRub.toLocaleString('ru-RU')} ₽`} />
          <MetricCard
            label="Расход LLM"
            value={`$${summary.llmCostUsd.toFixed(2)} · ${Math.round(summary.llmCostRub).toLocaleString('ru-RU')} ₽`}
          />
          <MetricCard label="Диалоги" value={String(summary.dialogs)} />
          <MetricCard label="Лиды" value={String(summary.leads)} />
        </div>
      )}

      {health && (
        <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">Статус системы</h2>
            <StatusPill
              label={health.status === 'ok' ? 'OK' : health.status === 'degraded' ? 'Деградация' : 'Ошибка'}
              ok={health.status === 'ok'}
            />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <ServiceRow label="PostgreSQL" ok={health.postgres === 'connected'} />
            <ServiceRow label="Redis" ok={health.redis === 'connected'} />
          </div>
          <h3 className="mt-6 text-sm font-medium text-slate-300">Очереди BullMQ</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-2">Очередь</th>
                  <th className="py-2">Waiting</th>
                  <th className="py-2">Active</th>
                  <th className="py-2">Delayed</th>
                  <th className="py-2">Failed</th>
                </tr>
              </thead>
              <tbody>
                {health.queues.map((q) => (
                  <tr key={q.name} className="border-t border-slate-800 text-slate-300">
                    <td className="py-2 font-mono text-xs">{q.name}</td>
                    <td className="py-2">{q.waiting}</td>
                    <td className="py-2">{q.active}</td>
                    <td className="py-2">{q.delayed}</td>
                    <td className={`py-2 ${q.failed > 0 ? 'text-red-400' : ''}`}>
                      {q.failed}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Обновлено: {new Date(health.timestamp).toLocaleString('ru-RU')}
          </p>
        </div>
      )}
    </div>
  );
}

function QuickCard({ to, label, description }: { to: string; label: string; description: string }) {
  return (
    <Link
      to={to}
      className="rounded-xl border border-slate-800 bg-slate-900 p-5 transition hover:border-slate-700 hover:bg-slate-800"
    >
      <p className="font-semibold text-slate-100">{label}</p>
      <p className="mt-1 text-sm text-slate-400">{description}</p>
    </Link>
  );
}

function StatusPill({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
        ok ? 'bg-emerald-900/50 text-emerald-300' : 'bg-red-900/50 text-red-300'
      }`}
    >
      {label}
    </span>
  );
}

function ServiceRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-800 px-4 py-3">
      <span className="text-slate-300">{label}</span>
      <StatusPill label={ok ? 'Подключён' : 'Недоступен'} ok={ok} />
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-100">{value}</p>
    </div>
  );
}
