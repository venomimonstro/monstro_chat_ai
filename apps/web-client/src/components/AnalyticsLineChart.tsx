import type { AnalyticsSeriesPoint } from '@ai-consultant/shared-types';

type Granularity = 'day' | 'week';

export function aggregateSeriesByWeek(
  series: AnalyticsSeriesPoint[],
): AnalyticsSeriesPoint[] {
  const buckets = new Map<string, number>();
  for (const row of series) {
    const date = new Date(`${row.label}T00:00:00Z`);
    const day = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() - day + 1);
    const key = date.toISOString().slice(0, 10);
    buckets.set(key, (buckets.get(key) ?? 0) + row.value);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, value]) => ({ label, value }));
}

export function AnalyticsLineChart({
  title,
  series,
  color = '#2563eb',
  empty,
  selectedDay,
  onSelectDay,
  granularity = 'day',
}: {
  title: string;
  series: AnalyticsSeriesPoint[];
  color?: string;
  empty?: boolean;
  selectedDay?: string | null;
  onSelectDay?: (day: string) => void;
  granularity?: Granularity;
}) {
  const data =
    granularity === 'week' ? aggregateSeriesByWeek(series) : series;

  if (empty || data.length === 0) {
    return (
      <div className="lk-card">
        <h3 className="font-medium text-slate-900">{title}</h3>
        <div className="mt-8 flex h-44 items-center justify-center text-sm text-slate-400">
          Нет данных за выбранный период
        </div>
      </div>
    );
  }

  const width = 640;
  const height = 176;
  const padX = 8;
  const padY = 12;
  const max = Math.max(...data.map((row) => row.value), 1);
  const step = data.length > 1 ? (width - padX * 2) / (data.length - 1) : 0;

  const points = data.map((row, index) => {
    const x = padX + index * step;
    const y = height - padY - (row.value / max) * (height - padY * 2);
    return { x, y, row };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ');
  const area = `${padX},${height - padY} ${polyline} ${width - padX},${height - padY}`;

  return (
    <div className="lk-card">
      <h3 className="font-medium text-slate-900">{title}</h3>
      <div className="mt-4 overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-44 w-full min-w-[320px]"
          role="img"
          aria-label={title}
        >
          <polygon points={area} fill={color} fillOpacity={0.12} />
          <polyline
            points={polyline}
            fill="none"
            stroke={color}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {points.map(({ x, y, row }) => (
            <g key={row.label}>
              <circle
                cx={x}
                cy={y}
                r={selectedDay === row.label ? 5 : 3.5}
                fill={selectedDay === row.label ? color : '#fff'}
                stroke={color}
                strokeWidth={2}
                className={onSelectDay ? 'cursor-pointer' : undefined}
                onClick={() => onSelectDay?.(row.label)}
              />
            </g>
          ))}
        </svg>
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-slate-400">
        <span>{data[0]?.label.slice(5)}</span>
        <span>{data[data.length - 1]?.label.slice(5)}</span>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Итого: {data.reduce((sum, row) => sum + row.value, 0)}
      </p>
    </div>
  );
}
