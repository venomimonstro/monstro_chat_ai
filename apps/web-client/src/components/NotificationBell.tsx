import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { NotificationDto } from '@ai-consultant/shared-types';
import { fetchWsToken } from '../lib/api';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../lib/notifications';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchNotifications();
      setItems(data.items);
      setUnreadCount(data.unreadCount);
    } catch {
      /* ignore polling errors */
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 60_000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    let cancelled = false;

    void fetchWsToken().then((token) => {
      if (!token || cancelled) return;
      const socket = io('/crm', {
        path: '/socket.io',
        auth: { token },
        transports: ['websocket', 'polling'],
      });
      socket.on('notification:new', (notification: NotificationDto) => {
        setItems((prev) => [notification, ...prev].slice(0, 30));
        setUnreadCount((c) => c + 1);
      });
      socketRef.current = socket;
    });

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id);
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const handleMarkAll = async () => {
    await markAllNotificationsRead();
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    setUnreadCount(0);
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100"
        aria-label="Уведомления"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 11-6 0m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="font-medium text-slate-900">Уведомления</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void handleMarkAll()}
                className="text-xs text-brand-600 hover:underline"
              >
                Прочитать все
              </button>
            )}
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-slate-400">Нет уведомлений</li>
            ) : (
              items.map((n) => (
                <li
                  key={n.id}
                  className={`border-b border-slate-50 px-4 py-3 text-sm ${
                    n.readAt ? 'bg-white' : 'bg-brand-50/40'
                  }`}
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => {
                      if (!n.readAt) void handleMarkRead(n.id);
                    }}
                  >
                    <p className="font-medium text-slate-900">{n.title}</p>
                    <p className="mt-0.5 text-slate-600">{n.body}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {new Date(n.createdAt).toLocaleString('ru-RU')}
                    </p>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
