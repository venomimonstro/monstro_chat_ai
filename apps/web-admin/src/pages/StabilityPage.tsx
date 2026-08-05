import { useEffect, useState } from 'react';
import {
  fetchStabilityIncidents,
  fetchStabilityStatus,
  runStabilityCheck,
} from '../lib/api';
import type { StabilityIncidentDto, StabilityStatusDto } from '@ai-consultant/shared-types';
import { ErrorState, LoadingState } from '../components/UiState';

const statusColors: Record<string, string> = {
  ok: 'bg-emerald-900/50 text-emerald-300',
  degraded: 'bg-amber-900/50 text-amber-300',
  down: 'bg-red-900/50 text-red-300',
};

export function StabilityPage() {
  const [status, setStatus] = useState<StabilityStatusDto | null>(null);
  const [incidents, setIncidents] = useState<StabilityIncidentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [st, inc] = await Promise.all([
        fetchStabilityStatus(),
        fetchStabilityIncidents(),
      ]);
      setStatus(st);
      setIncidents(inc);
    } catch {
      setError('Не удалось загрузить статус стабильности');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, []);

  const runCheck = async () => {
    setChecking(true);
    try {
      const st = await runStabilityCheck();
      setStatus(st);
      const inc = await fetchStabilityIncidents();
      setIncidents(inc);
    } finally {
      setChecking(false);
    }
  };

  if (loading) return <LoadingState message="Загрузка мониторинга…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Стабильность системы</h1>
          <p className="mt-1 text-sm text-slate-400">
            Мониторинг API, ЛК, админки, публичного сайта и чата. Проверка каждые 2 минуты.
          </p>
        </div>
        <button
          type="button"
          disabled={checking}
          onClick={runCheck}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
        >
          {checking ? 'Проверка…' : 'Проверить сейчас'}
        </button>
      </div>

      {status && (
        <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-slate-400">Общий статус:</span>
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${statusColors[status.overall] ?? statusColors.degraded}`}
            >
              {status.overall === 'ok'
                ? 'Стабильно'
                : status.overall === 'degraded'
                  ? 'Деградация'
                  : 'Сбой'}
            </span>
            <span className="text-xs text-slate-500">
              Открытых инцидентов: {status.openIncidents}
            </span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {status.probes.map((probe) => (
              <div
                key={probe.component}
                className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-slate-200">{probe.label}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${statusColors[probe.status]}`}
                  >
                    {probe.status}
                  </span>
                </div>
                {probe.message && (
                  <p className="mt-1 text-xs text-red-300">{probe.message}</p>
                )}
                {probe.latencyMs != null && (
                  <p className="mt-1 text-xs text-slate-500">{probe.latencyMs} мс</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="text-lg font-semibold text-slate-100">Инциденты</h2>
        {incidents.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">Инцидентов нет</p>
        ) : (
          <div className="mt-4 space-y-2">
            {incidents.map((inc) => (
              <div
                key={inc.id}
                className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-200">{inc.component}</span>
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      inc.severity === 'critical'
                        ? 'bg-red-900/50 text-red-300'
                        : 'bg-amber-900/50 text-amber-300'
                    }`}
                  >
                    {inc.severity}
                  </span>
                  {!inc.resolvedAt && (
                    <span className="text-xs text-red-400">активен</span>
                  )}
                </div>
                <p className="mt-1 text-slate-400">{inc.message}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {new Date(inc.createdAt).toLocaleString('ru-RU')}
                  {inc.resolvedAt &&
                    ` → закрыт ${new Date(inc.resolvedAt).toLocaleString('ru-RU')}`}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">
        <p className="font-medium text-slate-300">Авто-восстановление на сервере</p>
        <p className="mt-2">
          Установите cron для watchdog-скрипта — он перезапустит упавшие сервисы:
        </p>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-300">
          {`*/2 * * * * root /opt/redflow/scripts/health-watchdog.sh >> /var/log/aicw-watchdog.log 2>&1`}
        </pre>
      </div>
    </div>
  );
}
