import { useCallback, useEffect, useMemo, useState } from 'react';
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

export function ChatsPage() {
  const [sources, setSources] = useState<SourceDto[]>([]);
  const [items, setItems] = useState<DialogListItemDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DialogDetailDto | null>(null);
  const [messages, setMessages] = useState<DialogMessageDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sourceId, setSourceId] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'closed'>('all');
  const [hasLead, setHasLead] = useState<'all' | 'true' | 'false'>('all');
  const [query, setQuery] = useState('');

  const listParams = useMemo(() => {
    const params: Record<string, string> = { limit: '40' };
    if (sourceId) params.sourceId = sourceId;
    if (status !== 'all') params.status = status;
    if (hasLead !== 'all') params.hasLead = hasLead;
    if (query.trim()) params.q = query.trim();
    return params;
  }, [sourceId, status, hasLead, query]);

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
    setLoading(true);
    setItems([]);
    setSelectedId(null);
    setError(null);

    Promise.all([
      fetchSources(),
      fetchDialogs(listParams),
    ])
      .then(([sourceList, data]) => {
        if (cancelled) return;
        setSources(sourceList);
        setItems(data.items);
        setNextCursor(data.nextCursor);
        if (data.items.length > 0) {
          setSelectedId(data.items[0].id);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(extractErrorMessage(e, 'Не удалось загрузить диалоги'));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
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
    setDetailLoading(true);
    Promise.all([fetchDialog(selectedId), fetchDialogMessages(selectedId)])
      .then(([d, msgs]) => {
        setDetail(d);
        setMessages(msgs);
      })
      .catch((e: unknown) =>
        setError(extractErrorMessage(e, 'Не удалось загрузить переписку')),
      )
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

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
            setItems([]);
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
            setItems([]);
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
            setItems([]);
          }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="all">Лид: все</option>
          <option value="true">С лидом</option>
          <option value="false">Без лида</option>
        </select>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Телефон, имя, visitor…"
          className="min-w-[200px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="grid min-h-[560px] grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-3 py-2 text-xs font-medium text-slate-500">
            {items.length} диалогов
          </div>
          <ul className="max-h-[640px] overflow-y-auto divide-y divide-slate-100">
            {items.length === 0 && (
              <li className="p-4">
                <EmptyState title="Диалогов пока нет" />
              </li>
            )}
            {items.map((dialog) => (
              <li key={dialog.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(dialog.id)}
                  className={`w-full px-3 py-3 text-left transition hover:bg-slate-50 ${
                    selectedId === dialog.id ? 'bg-brand-50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {dialog.lead?.name ?? dialog.lead?.phone ?? 'Посетитель'}
                    </p>
                    <span className="shrink-0 text-[10px] text-slate-400">
                      {formatDateTime(dialog.updatedAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {dialog.sourceName ?? 'Источник'} ·{' '}
                    {STATUS_LABELS[dialog.status] ?? dialog.status}
                    {dialog.hasLead ? ' · лид' : ''}
                    {dialog.visitorDialogCount > 1 ? ' · возврат' : ''}
                  </p>
                  {dialog.lastMessage && (
                    <p className="mt-1 line-clamp-2 text-xs text-slate-600">
                      {dialog.lastMessage.content}
                    </p>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {nextCursor && (
            <div className="border-t border-slate-100 p-2">
              <button
                type="button"
                onClick={() => reloadList(nextCursor).catch(() => undefined)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Загрузить ещё
              </button>
            </div>
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
                        to="/crm"
                        className="rounded-lg border border-brand-600 px-3 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50"
                      >
                        Открыть лид
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => downloadDialogTranscript(detail.id).catch(() => undefined)}
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
