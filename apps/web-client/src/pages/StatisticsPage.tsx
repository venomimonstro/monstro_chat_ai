import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import type { SourceDto, TenantStatisticsDto } from '@ai-consultant/shared-types';
import {
  downloadTenantStatisticsCsv,
  fetchTenantStatistics,
} from '../lib/analytics';
import { fetchSources } from '../lib/sources';
import { localDateRange } from '../lib/dates';
import { extractErrorMessage } from '../lib/errors';
import { useAuth } from '../lib/auth';
import { hasPermission, PERMISSIONS } from '../lib/permissions';
import { PageHeader } from '../components/PageHeader';
import { SkeletonGrid } from '../components/Skeleton';
import { ErrorState } from '../components/EmptyState';

type Preset = '7d' | '30d' | '90d' | 'custom';

function rangeForPreset(preset: Preset) {
  if (preset === '7d') return localDateRange(7);
  if (preset === '30d') return localDateRange(30);
  return localDateRange(90);
}

function BarChart({
  title,
  series,
  color,
  empty,
  selectedDay,
  onSelectDay,
}: {
  title: string;
  series: TenantStatisticsDto['dialogsByDay'];
  color: string;
  empty?: boolean;
  selectedDay: string | null;
  onSelectDay: (day: string) => void;
}) {
  if (empty || series.length === 0) {
    return (
      <div className="lk-card">
        <h3 className="font-medium text-slate-900">{title}</h3>
        <div className="mt-8 flex h-40 items-center justify-center text-sm text-slate-400">
          Нет данных за выбранный период
        </div>
      </div>
    );
  }
  const max = Math.max(...series.map((row) => row.value), 1);
  return (
    <div className="lk-card">
      <h3 className="font-medium text-slate-900">{title}</h3>
      <div className="mt-4 flex h-40 items-end gap-1">
        {series.map((row) => (
          <button
            key={row.label}
            type="button"
            onClick={() => onSelectDay(row.label)}
            className="flex flex-1 flex-col items-center gap-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
            title={`${row.label}: ${row.value}`}
          >
            <div
              className={`w-full rounded-t transition-opacity ${color} ${
                selectedDay === row.label ? 'opacity-100 ring-2 ring-brand-400' : 'opacity-80 hover:opacity-100'
              }`}
              style={{ height: `${(row.value / max) * 100}%`, minHeight: 2 }}
            />
            <span className="truncate text-[10px] text-slate-400">
              {row.label.slice(5)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function StatisticsPage() {
  const { user } = useAuth();
  const initial = useMemo(() => rangeForPreset('30d'), []);
  const [preset, setPreset] = useState<Preset>('30d');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [stats, setStats] = useState<TenantStatisticsDto | null>(null);
  const [sources, setSources] = useState<SourceDto[]>([]);
  const [sourceId, setSourceId] = useState('');
  const [chartView, setChartView] = useState<'dialogs' | 'leads'>('dialogs');
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
      const [data, sourceList] = await Promise.all([
        fetchTenantStatistics(from, to, sourceId || undefined),
        sources.length > 0 ? Promise.resolve(sources) : fetchSources(),
      ]);
      setStats(data);
      if (sources.length === 0) setSources(sourceList);
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
  }, [from, to, sourceId, canView]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadTenantStatisticsCsv(from, to, sourceId || undefined);
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
    return { dialogs, leads };
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
    stats.dialogs === 0 && stats.leads === 0 && stats.messages === 0;

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
          <select
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            className="lk-input py-2 text-sm"
          >
            <option value="">Все источники</option>
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </select>
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

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <StatCard label="Диалоги" value={dayDetail.dialogs} />
            <StatCard label="Лиды" value={dayDetail.leads} />
          </div>
        </div>
      )}

      <div className="mt-8 lk-card">
        <h3 className="font-medium text-slate-900">Воронка чата</h3>
        <p className="mt-1 text-sm text-slate-500">
          Открытие → сообщение → контакт → лид
        </p>
        {stats.chatFunnel.stages.length === 0 ||
        stats.chatFunnel.stages.every((s) => s.count === 0) ? (
          <p className="mt-4 text-sm text-slate-500">
            Нет данных по воронке чата за период
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {stats.chatFunnel.stages.map((stage) => {
              const base = stats.chatFunnel.stages[0]?.count || 1;
              const width = Math.max((stage.count / base) * 100, 8);
              return (
                <div key={stage.key}>
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>{stage.label}</span>
                    <span>
                      {stage.count}
                      {stage.dropOffFromPrevious !== null && stage.count > 0 && (
                        <span className="ml-2 text-xs text-slate-400">
                          −{stage.dropOffFromPrevious}% от пред. этапа
                        </span>
                      )}
                    </span>
                  </div>
                  <div
                    className="mt-1 h-8 rounded-lg bg-indigo-100"
                    style={{ width: `${width}%` }}
                  >
                    <div className="flex h-full items-center rounded-lg bg-indigo-600 px-3 text-xs font-medium text-white">
                      {stage.rateFromTop}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {(stats.chatFunnel.byUtmSource.length > 0 ||
        stats.chatFunnel.byLandingPage.length > 0) && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {stats.chatFunnel.byUtmSource.length > 0 && (
            <FunnelBreakdownTable
              title="По UTM Source"
              rows={stats.chatFunnel.byUtmSource}
            />
          )}
          {stats.chatFunnel.byLandingPage.length > 0 && (
            <FunnelBreakdownTable
              title="По странице входа"
              rows={stats.chatFunnel.byLandingPage}
            />
          )}
        </div>
      )}

      <div className="mt-8 lk-card">
        <h3 className="font-medium text-slate-900">CRM-воронка</h3>
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

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={() => setChartView('dialogs')}
          className={`rounded-lg px-4 py-2 text-sm ${
            chartView === 'dialogs'
              ? 'bg-brand-600 text-white'
              : 'border border-slate-300 text-slate-700'
          }`}
        >
          Диалоги по дням
        </button>
        <button
          type="button"
          onClick={() => setChartView('leads')}
          className={`rounded-lg px-4 py-2 text-sm ${
            chartView === 'leads'
              ? 'bg-brand-600 text-white'
              : 'border border-slate-300 text-slate-700'
          }`}
        >
          Лиды по дням
        </button>
      </div>

      <div className="mt-4">
        {chartView === 'dialogs' ? (
          <BarChart
            title="Диалоги по дням"
            series={stats.dialogsByDay}
            color="bg-brand-600"
            empty={isEmpty}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
          />
        ) : (
          <BarChart
            title="Лиды по дням"
            series={stats.leadsByDay}
            color="bg-emerald-500"
            empty={isEmpty}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
          />
        )}
      </div>
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

function FunnelBreakdownTable({
  title,
  rows,
}: {
  title: string;
  rows: TenantStatisticsDto['chatFunnel']['byUtmSource'];
}) {
  return (
    <div className="lk-card overflow-x-auto">
      <h3 className="font-medium text-slate-900">{title}</h3>
      <table className="mt-3 w-full min-w-[420px] text-left text-xs">
        <thead className="text-slate-500">
          <tr>
            <th className="py-2 pr-2">Источник</th>
            <th className="py-2 px-2">Открытия</th>
            <th className="py-2 px-2">Сообщ.</th>
            <th className="py-2 px-2">Контакт</th>
            <th className="py-2 pl-2">Лиды</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-slate-100 text-slate-700">
              <td className="max-w-[140px] truncate py-2 pr-2" title={row.label}>
                {row.label}
              </td>
              <td className="py-2 px-2">{row.widgetOpen}</td>
              <td className="py-2 px-2">{row.firstMessage}</td>
              <td className="py-2 px-2">{row.contactShared}</td>
              <td className="py-2 pl-2">{row.leadCreated}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
