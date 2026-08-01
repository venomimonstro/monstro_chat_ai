import { useCallback, useEffect, useState } from 'react';
import GridLayout, { type Layout } from 'react-grid-layout';
import type {
  AnalyticsDashboardDto,
  AnalyticsMetric,
  AnalyticsQueryResponse,
  AnalyticsWidgetConfig,
} from '@ai-consultant/shared-types';
import {
  createAnalyticsDashboard,
  fetchAnalyticsDashboards,
  fetchAnalyticsQuery,
  updateAnalyticsDashboard,
} from '../lib/api';
import { EmptyState, ErrorState, LoadingState } from '../components/UiState';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const metricLabels: Record<AnalyticsMetric, string> = {
  mrr: 'MRR',
  dialogs: 'Диалоги',
  leads: 'Лиды',
  conversion: 'Конверсия',
};

const dimensionLabels: Record<string, string> = {
  date: 'По дате',
  tariff: 'По тарифу',
  tenant: 'По клиенту',
  source: 'По источнику',
};

function previousRange(from: string, to: string) {
  const start = new Date(from);
  const end = new Date(to);
  const days = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1,
  );
  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - days + 1);
  return {
    from: prevStart.toISOString().slice(0, 10),
    to: prevEnd.toISOString().slice(0, 10),
  };
}

function WidgetChart({ data }: { data: AnalyticsQueryResponse | null }) {
  if (!data) {
    return <p className="text-sm text-slate-500">Загрузка…</p>;
  }
  if (data.series.length === 0) {
    return <p className="text-sm text-slate-500">Нет данных</p>;
  }
  const max = Math.max(...data.series.map((row) => row.value), 1);
  return (
    <div className="space-y-2">
      {data.series.slice(0, 8).map((row) => (
        <div key={row.label}>
          <div className="flex justify-between text-xs text-slate-400">
            <span>{row.label}</span>
            <span>{row.value}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-brand-500"
              style={{ width: `${(row.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
      <p className="text-xs text-slate-500">Итого: {data.total}</p>
    </div>
  );
}

export function AnalyticsPage() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [compare, setCompare] = useState(false);
  const [dashboards, setDashboards] = useState<AnalyticsDashboardDto[]>([]);
  const [active, setActive] = useState<AnalyticsDashboardDto | null>(null);
  const [widgets, setWidgets] = useState<AnalyticsWidgetConfig[]>([]);
  const [widgetData, setWidgetData] = useState<
    Record<string, AnalyticsQueryResponse>
  >({});
  const [compareData, setCompareData] = useState<
    Record<string, AnalyticsQueryResponse>
  >({});
  const [showModal, setShowModal] = useState(false);
  const [draftMetric, setDraftMetric] = useState<AnalyticsMetric>('mrr');
  const [draftDimension, setDraftDimension] = useState<
    'date' | 'tariff' | 'tenant' | 'source'
  >('tariff');
  const [name, setName] = useState('Основной дашборд');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadDashboards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchAnalyticsDashboards();
      setDashboards(rows);
      if (!active && rows.length > 0) {
        setActive(rows[0]);
        setWidgets(rows[0].widgets);
        setName(rows[0].name);
      }
    } catch {
      setError('Не удалось загрузить дашборды');
    } finally {
      setLoading(false);
    }
  }, [active]);

  useEffect(() => {
    loadDashboards();
  }, [loadDashboards]);

  useEffect(() => {
    if (!widgets.length) return;
    const prevRange = compare ? previousRange(from, to) : null;
    widgets.forEach((widget) => {
      fetchAnalyticsQuery({
        metric: widget.metric,
        dimension: widget.dimension,
        from,
        to,
      })
        .then((data) =>
          setWidgetData((prev) => ({ ...prev, [widget.id]: data })),
        )
        .catch(() => undefined);
      if (prevRange) {
        fetchAnalyticsQuery({
          metric: widget.metric,
          dimension: widget.dimension,
          from: prevRange.from,
          to: prevRange.to,
        })
          .then((data) =>
            setCompareData((prev) => ({ ...prev, [widget.id]: data })),
          )
          .catch(() => undefined);
      }
    });
  }, [widgets, from, to, compare]);

  const layout: Layout[] = widgets.map((widget) => ({
    i: widget.id,
    x: widget.x,
    y: widget.y,
    w: widget.w,
    h: widget.h,
    minW: 3,
    minH: 2,
  }));

  const onLayoutChange = (next: Layout[]) => {
    setWidgets((prev) =>
      prev.map((widget) => {
        const item = next.find((row) => row.i === widget.id);
        if (!item) return widget;
        return {
          ...widget,
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
        };
      }),
    );
  };

  const addWidget = () => {
    const id = crypto.randomUUID();
    setWidgets((prev) => [
      ...prev,
      {
        id,
        metric: draftMetric,
        dimension: draftDimension,
        chartType: 'bar',
        x: (prev.length * 3) % 12,
        y: Infinity,
        w: 4,
        h: 3,
      },
    ]);
    setShowModal(false);
  };

  const saveDashboard = async () => {
    setSaving(true);
    try {
      const payload = { name, widgets };
      if (active) {
        const updated = await updateAnalyticsDashboard(active.id, payload);
        setActive(updated);
        setDashboards((prev) =>
          prev.map((row) => (row.id === updated.id ? updated : row)),
        );
      } else {
        const created = await createAnalyticsDashboard(payload);
        setActive(created);
        setDashboards((prev) => [created, ...prev]);
      }
    } catch {
      setError('Не удалось сохранить дашборд');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState message="Загрузка дашбордов…" />;
  if (error) return <ErrorState message={error} onRetry={loadDashboards} />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-100">Аналитика</h1>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <input
          type="date"
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <span className="text-slate-500">—</span>
        <input
          type="date"
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm text-slate-400">
          <input
            type="checkbox"
            checked={compare}
            onChange={(e) => setCompare(e.target.checked)}
          />
          Сравнить с предыдущим периодом
        </label>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <input
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Название дашборда"
        />
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
        >
          Добавить виджет
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={saveDashboard}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? 'Сохранение…' : 'Сохранить дашборд'}
        </button>
        {dashboards.length > 0 && (
          <select
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            value={active?.id ?? ''}
            onChange={(e) => {
              const row = dashboards.find((item) => item.id === e.target.value);
              if (!row) return;
              setActive(row);
              setWidgets(row.widgets);
              setName(row.name);
            }}
          >
            {dashboards.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="mt-8">
        {widgets.length === 0 ? (
          <EmptyState
            title="Дашборд пуст"
            description="Добавьте первый виджет, чтобы увидеть метрики."
            action={
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                Добавить виджет
              </button>
            }
          />
        ) : (
          <GridLayout
            className="layout"
            layout={layout}
            cols={12}
            rowHeight={80}
            width={1100}
            onLayoutChange={onLayoutChange}
            draggableHandle=".widget-drag"
          >
            {widgets.map((widget) => (
              <div
                key={widget.id}
                className="rounded-xl border border-slate-800 bg-slate-900 p-4"
              >
                <div className="widget-drag mb-3 cursor-move text-sm font-medium text-slate-200">
                  {metricLabels[widget.metric]}
                  {widget.dimension ? ` · ${dimensionLabels[widget.dimension] ?? widget.dimension}` : ''}
                </div>
                <WidgetChart data={widgetData[widget.id] ?? null} />
                {compare && compareData[widget.id] && (
                  <div className="mt-3 border-t border-slate-800 pt-3">
                    <p className="mb-2 text-xs text-slate-500">Предыдущий период</p>
                    <WidgetChart data={compareData[widget.id] ?? null} />
                  </div>
                )}
              </div>
            ))}
          </GridLayout>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6">
            <h2 className="text-lg font-semibold text-slate-100">Новый виджет</h2>
            <div className="mt-4 space-y-3">
              <select
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                value={draftMetric}
                onChange={(e) =>
                  setDraftMetric(e.target.value as AnalyticsMetric)
                }
              >
                {Object.entries(metricLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                value={draftDimension}
                onChange={(e) =>
                  setDraftDimension(
                    e.target.value as 'date' | 'tariff' | 'tenant' | 'source',
                  )
                }
              >
                {Object.entries(dimensionLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={addWidget}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white"
              >
                Добавить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
