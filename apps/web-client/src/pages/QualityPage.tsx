import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { BadAnswerDto, QualityStatsDto } from '@ai-consultant/shared-types';
import { fetchBadAnswers, fetchQualityStats } from '../lib/quality';
import { fetchSources } from '../lib/sources';
import type { SourceDto } from '@ai-consultant/shared-types';
import { extractErrorMessage } from '../lib/errors';
import { EmptyState, ErrorState, LoadingState } from '../components/EmptyState';

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRate(rate: number | null) {
  if (rate === null) return '—';
  return `${Math.round(rate * 100)}%`;
}

export function QualityPage() {
  const [sources, setSources] = useState<SourceDto[]>([]);
  const [sourceId, setSourceId] = useState('');
  const [stats, setStats] = useState<QualityStatsDto | null>(null);
  const [items, setItems] = useState<BadAnswerDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sourceList, statsData, badData] = await Promise.all([
        fetchSources(),
        fetchQualityStats(sourceId || undefined),
        fetchBadAnswers({ sourceId: sourceId || undefined, limit: 30 }),
      ]);
      setSources(sourceList);
      setStats(statsData);
      setItems(badData.items);
      setNextCursor(badData.nextCursor);
    } catch (e: unknown) {
      setError(extractErrorMessage(e, 'Не удалось загрузить качество ответов'));
    } finally {
      setLoading(false);
    }
  }, [sourceId]);

  useEffect(() => {
    reload().catch(() => undefined);
  }, [reload]);

  const loadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const data = await fetchBadAnswers({
        sourceId: sourceId || undefined,
        cursor: nextCursor,
        limit: 30,
      });
      setItems((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
    } catch (e: unknown) {
      setError(extractErrorMessage(e, 'Не удалось загрузить ещё'));
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading && !stats) {
    return <LoadingState message="Загрузка качества ответов…" />;
  }

  if (error && !stats) {
    return <ErrorState message={error} onRetry={() => reload()} />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Качество ответов</h1>
        <p className="mt-1 text-sm text-slate-500">
          Оценки посетителей и журнал неудачных ответов ассистента
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Все источники</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {stats && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">👍 Положительные</p>
            <p className="mt-1 text-2xl font-semibold text-green-700">{stats.up}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">👎 Отрицательные</p>
            <p className="mt-1 text-2xl font-semibold text-red-600">{stats.down}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Удовлетворённость</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {formatRate(stats.satisfactionRate)}
            </p>
          </div>
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Журнал плохих ответов</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Сообщения с оценкой 👎 — используйте для улучшения промпта и базы знаний
          </p>
        </div>

        {items.length === 0 ? (
          <div className="p-6">
            <EmptyState title="Плохих оценок пока нет" />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((item) => (
              <li key={item.id} className="px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-slate-500">
                      {item.sourceName ?? 'Источник'} · {formatDateTime(item.createdAt)}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      visitor: {item.visitorId}
                    </p>
                  </div>
                  <Link
                    to={`/chats`}
                    className="text-xs font-medium text-brand-600 hover:underline"
                    title="Открыть в разделе чатов"
                  >
                    Диалог
                  </Link>
                </div>
                {item.userQuestion && (
                  <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <p className="text-[11px] font-medium text-slate-500">Вопрос</p>
                    <p className="mt-1 whitespace-pre-wrap text-slate-800">
                      {item.userQuestion}
                    </p>
                  </div>
                )}
                <div className="mt-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm">
                  <p className="text-[11px] font-medium text-red-600">Ответ ассистента</p>
                  <p className="mt-1 whitespace-pre-wrap text-slate-800">
                    {item.assistantAnswer}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {nextCursor && (
          <div className="border-t border-slate-100 p-3">
            <button
              type="button"
              onClick={() => loadMore().catch(() => undefined)}
              disabled={loadingMore}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {loadingMore ? 'Загрузка…' : 'Загрузить ещё'}
            </button>
          </div>
        )}
      </section>

      {error && stats && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
