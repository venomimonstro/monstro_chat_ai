import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { extractErrorMessage } from '../lib/errors';
import {
  fetchDialog,
  fetchDialogMessages,
  fetchDialogs,
  downloadDialogTranscript,
  type DialogDetailDto,
  type DialogListItemDto,
  type DialogMessageDto,
} from '../lib/dialogs';
import { fetchSources } from '../lib/sources';
import type { SourceDto } from '@ai-consultant/shared-types';
import { EmptyState, ErrorState, LoadingState } from '../components/EmptyState';

const STATUS_LABELS: Record<string, string> = {
  active: 'Активен',
  closed: 'Закрыт',
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function roleLabel(role: string) {
  if (role === 'user') return 'Посетитель';
  if (role === 'manager') return 'Менеджер';
  return 'Ассистент';
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function ChatsPage() {
  const [sources, setSources] = useState<SourceDto[]>([]);
  const [items, setItems] = useState<DialogListItemDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedIdRef = useRef(selectedId);
  const [detail, setDetail] = useState<DialogDetailDto | null>(null);
  const [messages, setMessages] = useState<DialogMessageDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sourceId, setSourceId] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'closed'>('all');
  const [hasLead, setHasLead] = useState<'all' | 'true' | 'false'>('all');
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 350);

  const listParams = useMemo(() => {
    const params: Record<string, string> = { limit: '40' };
    if (sourceId) params.sourceId = sourceId;
    if (status !== 'all') params.status = status;
    if (hasLead !== 'all') params.hasLead = hasLead;
    if (debouncedQuery.trim()) params.q = debouncedQuery.trim();
    return params;
  }, [sourceId, status, hasLead, debouncedQuery]);

  const reloadList = useCallback(
    async (cursor?: string) => {
      setError(null);
      const params = { ...listParams, ...(cursor ? { cursor } : {}) };
      const data = await fetchDialogs(params);
      setItems((prev) => (cursor ? [...prev, ...data.items] : data.items));
      setNextCursor(data.nextCursor);
      if (!cursor && data.items.length > 0 && !selectedId) {
        setSelectedId(data.items[0].id);
      }
    },
    [listParams, selectedId],
  );

  useEffect(() => {
    let cancelled = false;
    setListLoading(true);
    if (items.length === 0) setLoading(true);
    setError(null);

    Promise.all([fetchSources(), fetchDialogs(listParams)])
      .then(([sourceList, data]) => {
        if (cancelled) return;
        setSources(sourceList);
        setItems(data.items);
        setNextCursor(data.nextCursor);
        if (data.items.length > 0) {
          setSelectedId((prev) =>
            prev && data.items.some((item) => item.id === prev)
              ? prev
              : data.items[0].id,
          );
        } else {
          setSelectedId(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(extractErrorMessage(e, 'Не удалось загрузить диалоги'));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setListLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [listParams]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setMessages([]);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);

    Promise.all([fetchDialog(selectedId), fetchDialogMessages(selectedId)])
      .then(([d, msgs]) => {
        if (cancelled) return;
        setDetail(d);
        setMessages(msgs);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(extractErrorMessage(e, 'Не удалось загрузить переписку'));
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
    if (!selectedId || detailLoading) return undefined;

    let currentController: AbortController | null = null;
    const interval = window.setInterval(() => {
      currentController?.abort();
      currentController = new AbortController();
      fetchDialogMessages(selectedId, { signal: currentController.signal })
        .then((msgs) => {
          if (selectedIdRef.current !== selectedId) return;
          setMessages((prev) => {
            if (msgs.length === prev.length && msgs.at(-1)?.id === prev.at(-1)?.id) {
              return prev;
            }
            return msgs;
          });
        })
        .catch(() => undefined);
    }, 20_000);

    return () => {
      currentController?.abort();
      window.clearInterval(interval);
    };
  }, [selectedId, detailLoading]);

  if (loading && items.length === 0) {
    return <LoadingState message="Загрузка диалогов…" />;
  }

  if (error && items.length === 0) {
    return <ErrorState message={error} onRetry={() => reloadList()} />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Чаты</h1>
        <p className="mt-1 text-sm text-slate-500">
          Полная история переписки с посетителями, включая возвращающихся
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={sourceId}
          onChange={(e) => {
            setSourceId(e.target.value);
            setSelectedId(null);
          }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Все источники</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as typeof status);
            setSelectedId(null);
          }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="all">Все статусы</option>
          <option value="active">Активные</option>
          <option value="closed">Закрытые</option>
        </select>
        <select
          value={hasLead}
          onChange={(e) => {
            setHasLead(e.target.value as typeof hasLead);
            setSelectedId(null);
          }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="all">Все диалоги</option>
          <option value="true">С лидом</option>
          <option value="false">Без лида</option>
        </select>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по тексту…"
          className="min-w-[200px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="grid min-h-[520px] grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        <section className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
          {listLoading && (
            <p className="border-b border-slate-100 px-3 py-2 text-xs text-slate-500">
              Обновление списка…
            </p>
          )}
          {items.length === 0 ? (
            <EmptyState title="Диалогов нет" description="Пока нет переписок" />
          ) : (
            <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={`w-full px-3 py-3 text-left text-sm transition hover:bg-slate-50 ${
                      selectedId === item.id ? 'bg-brand-50' : ''
                    }`}
                  >
                    <p className="font-medium text-slate-900">
                      {item.lead?.name ?? item.visitorId.slice(0, 12)}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                      {item.lastMessage?.content ?? '—'}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {nextCursor && (
            <button
              type="button"
              className="border-t border-slate-100 px-3 py-2 text-sm text-brand-600 hover:bg-slate-50"
              onClick={() =>
                reloadList(nextCursor).catch((e: unknown) =>
                  setError(extractErrorMessage(e, 'Не удалось загрузить ещё')),
                )
              }
            >
              Загрузить ещё
            </button>
          )}
        </section>

        <section className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
          {!selectedId ? (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-slate-500">
              Выберите диалог слева
            </div>
          ) : detailLoading ? (
            <LoadingState message="Загрузка переписки…" />
          ) : detail ? (
            <>
              <div className="border-b border-slate-100 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      {detail.lead?.name ?? detail.lead?.phone ?? 'Посетитель'}
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      {detail.sourceName} · {STATUS_LABELS[detail.status]} ·{' '}
                      {detail.messageCount} сообщений
                      {detail.isReturningVisitor
                        ? ` · возвращался (${detail.priorDialogCount + 1} визитов)`
                        : ''}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      visitor: {detail.visitorId}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {detail.lead && (
                      <Link
                        to={`/crm?leadId=${detail.lead.id}`}
                        className="rounded-lg border border-brand-600 px-3 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50"
                      >
                        Открыть лид
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        downloadDialogTranscript(detail.id).catch((e: unknown) =>
                          setError(extractErrorMessage(e, 'Не удалось экспортировать')),
                        )
                      }
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                    >
                      Экспорт .txt
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {messages.length === 0 && (
                  <p className="text-sm text-slate-500">Сообщений пока нет</p>
                )}
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`rounded-xl px-3 py-2 text-sm ${
                      msg.role === 'user'
                        ? 'ml-8 bg-slate-100 text-slate-800'
                        : 'mr-8 bg-brand-50 text-slate-800'
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                      <span>{roleLabel(msg.role)}</span>
                      <span>{formatDateTime(msg.createdAt)}</span>
                    </div>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </section>
      </div>

      {error && items.length > 0 && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
