'use client';

import { useEffect, useState } from 'react';
import type { PublicDiagnosticsDto } from '@ai-consultant/shared-types';
import { getBrowserApiBase } from '@/lib/api-url';

const statusColors: Record<string, string> = {
  ok: 'text-emerald-600',
  degraded: 'text-amber-600',
  down: 'text-red-600',
};

export function DiagnosticsPageClient({ token }: { token: string }) {
  const [data, setData] = useState<PublicDiagnosticsDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const apiBase = getBrowserApiBase();
      const res = await fetch(`${apiBase}/public/diagnostics/${encodeURIComponent(token)}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Ссылка недействительна или устарела');
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, [token]);

  if (loading && !data) {
    return <p className="text-slate-600">Загрузка диагностики…</p>;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
        {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">Диагностика системы</h1>
          <span className={`text-sm font-semibold uppercase ${statusColors[data.overall]}`}>
            {data.overall === 'ok' ? 'Стабильно' : data.overall === 'degraded' ? 'Деградация' : 'Сбой'}
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          Версия {data.version} · спринт {data.sprint} · проверено{' '}
          {new Date(data.checkedAt).toLocaleString('ru-RU')}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Открытых инцидентов: {data.openIncidents}
        </p>
        <button
          type="button"
          onClick={load}
          className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white"
        >
          Обновить
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {data.probes.map((probe) => (
          <div
            key={probe.component}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-slate-900">{probe.label}</p>
              <span className={`text-xs font-semibold uppercase ${statusColors[probe.status]}`}>
                {probe.status}
              </span>
            </div>
            {probe.message && (
              <p className="mt-1 text-sm text-red-600">{probe.message}</p>
            )}
            {probe.latencyMs != null && (
              <p className="mt-1 text-xs text-slate-500">{probe.latencyMs} мс</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
