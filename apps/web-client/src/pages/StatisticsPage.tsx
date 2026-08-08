import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import type { TenantStatisticsDto } from '@ai-consultant/shared-types';
import {
  downloadTenantStatisticsCsv,
  fetchTenantStatistics,
} from '../lib/analytics';
import { localDateRange } from '../lib/dates';
import { extractErrorMessage } from '../lib/errors';
import { useAuth } from '../lib/auth';
import { hasPermission, PERMISSIONS } from '../lib/permissions';
import { PageHeader } from '../components/PageHeader';
import { SkeletonGrid } from '../components/Skeleton';
import { ErrorState } from '../components/EmptyState';
import { AnalyticsLineChart } from '../components/AnalyticsLineChart';

type Preset = '7d' | '30d' | '90d' | 'custom';
type ChartMetric = 'dialogs' | 'leads' | 'visits';
type Granularity = 'day' | 'week';

function rangeForPreset(preset: Preset) {
  if (preset === '7d') return localDateRange(7);
  if (preset === '30d') return localDateRange(30);
  return localDateRange(90);
}

export function StatisticsPage() {
  const { user } = useAuth();
  const initial = useMemo(() => rangeForPreset('30d'), []);
  const [preset, setPreset] = useState<Preset>('30d');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [stats, setStats] = useState<TenantStatisticsDto | null>(null);
  const [chartView, setChartView] = useState<ChartMetric>('dialogs');
  const [granularity, setGranularity] = useState<Granularity>('day');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);
  const canView = hasPermission(user, PERMISSIONS.ANALYTICS_VIEW);

  const applyPreset = (p: Preset) => {
    setPreset(p);
    if (p !== 'custom') {
      const r = rangeForPreset(p);
      setFrom(r.from);
      setTo(r.to);
      setSelectedDay(null);
    }
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTenantStatistics(from, to);
      setStats(data);
    } catch (err) {
      setError(extractErrorMessage(err));
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) return;
    load();
  }, [from, to, canView]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadTenantStatisticsCsv(from, to);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const dayDetail = useMemo(() => {
    if (!stats || !selectedDay) return null;
    const dialogs = stats.dialogsByDay.find((d) => d.label === selectedDay)?.value ?? 0;
    const leads = stats.leadsByDay.find((d) => d.label === selectedDay)?.value ?? 0;
    const visits = stats.visitsByDay.find((d) => d.label === selectedDay)?.value ?? 0;
    return { dialogs, leads, visits };
  }, [stats, selectedDay]);

  if (!canView) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Статистика" description="Диалоги, лиды и конверсия" />
        <SkeletonGrid count={4} />
      </div>
    );
  }
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!stats) return null;

  const isEmpty =
    stats.dialogs === 0 && stats.leads === 0 && stats.messages === 0 && stats.visits === 0;

  const chartSeries =
    chartView === 'dialogs'
      ? stats.dialogsByDay
      : chartView === 'leads'
        ? stats.leadsByDay
        : stats.visitsByDay;

  const chartTitle =
    chartView === 'dialogs'
      ? 'Открытые диалоги'
      : chartView === 'leads'
        ? 'Лиды'
        : 'Уникальные посетители';

  const chartColor =
    chartView === 'dialogs' ? '#2563eb' : chartView === 'leads' ? '#059669' : '#7c3aed';

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Статистика"
          description="Диалоги, лиды и конверсия за выбранный период"
        />
        <div className="flex flex-wrap items-center gap-2">
          {(['7d', '30d', '90d'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => applyPreset(p)}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                preset === p
                  ? 'bg-brand-600 text-white'
                  : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {p === '7d' ? '7 дней' : p === '30d' ? '30 дней' : '90 дней'}
            </button>
          ))}
          <input
            type="date"
            className="lk-input py-2 text-sm"
            value={from}
            onChange={(e) => {
              setPreset('custom');
              setFrom(e.target.value);
              setSelectedDay(null);
            }}
          />
          <span className="text-slate-400">—</span>
          <input
            type="date"
            className="lk-input py-2 text-sm"
            value={to}
            onChange={(e) => {
              setPreset('custom');
              setTo(e.target.value);
              setSelectedDay(null);
            }}
          />
          <button
            type="button"
            onClick={exportCsv}
            disabled={exporting}
            className="lk-btn-secondary"
          >
            {exporting ? 'Экспорт…' : 'Экспорт CSV'}
          </button>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Посетители" value={stats.visits} />
        <StatCard label="Диалоги" value={stats.dialogs} />
        <StatCard label="Лиды" value={stats.leads} />
        <StatCard label="Сообщения" value={stats.messages} />
        <StatCard label="Конверсия" value={`${stats.conversionRate}%`} />
      </div>

      {selectedDay && dayDetail && (
        <div className="mt-6 lk-card">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-slate-900">
              Детали за {selectedDay}
            </h3>
            <button
              type="button"
              onClick={() => setSelectedDay(null)}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Закрыть
            </button>
          </div>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <StatCard label="Посетители" value={dayDetail.visits} />
            <StatCard label="Диалоги" value={dayDetail.dialogs} />
            <StatCard label="Лиды" value={dayDetail.leads} />
          </div>
        </div>
      )}

      <div className="mt-8 lk-card">
        <h3 className="font-medium text-slate-900">Воронка</h3>
        {stats.funnel.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Нет данных по воронке</p>
        ) : (
          <div className="mt-4 space-y-3">
            {stats.funnel.map((stage, index) => {
              const base = stats.funnel[0]?.count || 1;
              const width = Math.max((stage.count / base) * 100, 8);
              return (
                <div key={stage.stage}>
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>{stage.stage}</span>
                    <span>{stage.count}</span>
                  </div>
                  <div
                    className="mt-1 h-8 rounded-lg bg-brand-100"
                    style={{ width: `${width}%` }}
                  >
                    <div className="flex h-full items-center rounded-lg bg-brand-600 px-3 text-xs font-medium text-white">
                      {index === stats.funnel.length - 1
                        ? `${stats.conversionRate}%`
                        : ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {(
          [
            ['dialogs', 'Диалоги'],
            ['leads', 'Лиды'],
            ['visits', 'Посетители'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setChartView(key)}
            className={`rounded-lg px-4 py-2 text-sm ${
              chartView === key
                ? 'bg-brand-600 text-white'
                : 'border border-slate-300 text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
        <span className="mx-1 w-px self-stretch bg-slate-200" />
        <button
          type="button"
          onClick={() => setGranularity('day')}
          className={`rounded-lg px-3 py-2 text-sm ${
            granularity === 'day'
              ? 'bg-slate-800 text-white'
              : 'border border-slate-300 text-slate-700'
          }`}
        >
          По дням
        </button>
        <button
          type="button"
          onClick={() => setGranularity('week')}
          className={`rounded-lg px-3 py-2 text-sm ${
            granularity === 'week'
              ? 'bg-slate-800 text-white'
              : 'border border-slate-300 text-slate-700'
          }`}
        >
          По неделям
        </button>
      </div>

      <div className="mt-4">
        <AnalyticsLineChart
          title={chartTitle}
          series={chartSeries}
          color={chartColor}
          empty={isEmpty}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
          granularity={granularity}
        />
      </div>

      {stats.leadsByStatus.length > 0 && (
        <div className="mt-8 lk-card">
          <h3 className="font-medium text-slate-900">Лиды по статусам</h3>
          <div className="mt-4 space-y-2">
            {stats.leadsByStatus.map((row) => (
              <div key={row.status} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">{row.status}</span>
                <span className="font-medium text-slate-900">{row.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="lk-card">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
