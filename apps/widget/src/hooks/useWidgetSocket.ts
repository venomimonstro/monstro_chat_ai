import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { prefetchSocketClient } from '../utils/prefetchSocket';

export type WidgetConnectionPhase =
  | 'idle'
  | 'connecting'
  | 'joining'
  | 'ready'
  | 'reconnecting'
  | 'error';

export interface WidgetJoinPayload {
  widgetKey: string;
  visitorId: string;
  dialogId?: string;
  parentOrigin?: string;
  sessionToken?: string;
  attribution?: unknown;
}

export interface WidgetJoinedEvent {
  sessionToken?: string;
  dialogId?: string | null;
}

export interface UseWidgetSocketOptions {
  widgetKey: string;
  apiUrl: string;
  visitorId: string;
  enabled: boolean;
  buildJoinPayload: () => WidgetJoinPayload;
  onJoined: (data: WidgetJoinedEvent) => void;
  onSocketError: (data: { code?: string; message?: string }) => void;
  onSocketReady?: (socket: Socket) => void;
}

function getSocketOrigin(apiUrl: string): string {
  if (apiUrl.startsWith('/')) return window.location.origin;
  return apiUrl.replace(/\/api\/?$/, '');
}

const JOIN_RETRY_MS = 12_000;
const ERROR_AFTER_MS = 30_000;

export function useWidgetSocket({
  widgetKey,
  apiUrl,
  visitorId,
  enabled,
  buildJoinPayload,
  onJoined,
  onSocketError,
  onSocketReady,
}: UseWidgetSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const joinedRef = useRef(false);
  const joinSentRef = useRef(false);
  const joinRetryTimerRef = useRef<number | null>(null);
  const errorTimerRef = useRef<number | null>(null);
  const connectingRef = useRef(false);
  const fatalErrorRef = useRef<string | null>(null);

  const [phase, setPhase] = useState<WidgetConnectionPhase>('idle');
  const [statusText, setStatusText] = useState<string | null>(null);

  const callbacksRef = useRef({ onJoined, onSocketError, buildJoinPayload, onSocketReady });
  callbacksRef.current = { onJoined, onSocketError, buildJoinPayload, onSocketReady };

  const clearJoinRetry = useCallback(() => {
    if (joinRetryTimerRef.current !== null) {
      window.clearTimeout(joinRetryTimerRef.current);
      joinRetryTimerRef.current = null;
    }
  }, []);

  const clearErrorTimer = useCallback(() => {
    if (errorTimerRef.current !== null) {
      window.clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
  }, []);

  const scheduleJoinRetry = useCallback(() => {
    clearJoinRetry();
    joinRetryTimerRef.current = window.setTimeout(() => {
      const socket = socketRef.current;
      if (!socket?.connected || joinedRef.current) return;
      joinSentRef.current = false;
      joinSentRef.current = true;
      socket.emit('join', callbacksRef.current.buildJoinPayload());
      setPhase('joining');
      setStatusText('Подключаемся…');
    }, JOIN_RETRY_MS);
  }, [clearJoinRetry]);

  const emitJoin = useCallback(() => {
    const socket = socketRef.current;
    if (!socket?.connected || joinedRef.current || joinSentRef.current) return;
    joinSentRef.current = true;
    socket.emit('join', callbacksRef.current.buildJoinPayload());
    setPhase('joining');
    if (!fatalErrorRef.current) {
      setStatusText('Подключаемся…');
    }
    scheduleJoinRetry();
  }, [scheduleJoinRetry]);

  const markReady = useCallback((data: WidgetJoinedEvent) => {
    clearJoinRetry();
    clearErrorTimer();
    joinSentRef.current = false;
    joinedRef.current = true;
    fatalErrorRef.current = null;
    setPhase('ready');
    setStatusText(null);
    callbacksRef.current.onJoined(data);
  }, [clearErrorTimer, clearJoinRetry]);

  const teardownSocket = useCallback(() => {
    clearJoinRetry();
    clearErrorTimer();
    const socket = socketRef.current;
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    }
    joinedRef.current = false;
    joinSentRef.current = false;
    connectingRef.current = false;
  }, [clearErrorTimer, clearJoinRetry]);

  const connect = useCallback(async () => {
    if (!widgetKey || !enabled) return;

    const existing = socketRef.current;
    if (existing?.connected) {
      if (!joinedRef.current) emitJoin();
      return;
    }
    if (connectingRef.current) return;
    connectingRef.current = true;
    setPhase('connecting');
    if (!fatalErrorRef.current) {
      setStatusText('Подключаемся…');
    }

    clearErrorTimer();
    errorTimerRef.current = window.setTimeout(() => {
      if (!joinedRef.current && !fatalErrorRef.current) {
        setPhase('error');
        setStatusText('Нет соединения с сервером чата');
      }
    }, ERROR_AFTER_MS);

    try {
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      const { io } = await prefetchSocketClient();
      const origin = getSocketOrigin(apiUrl);

      const socket = io(`${origin}/widget`, {
        path: '/socket.io',
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 500,
        reconnectionDelayMax: 5000,
        randomizationFactor: 0.3,
        timeout: 25_000,
      });

      socket.on('connect', () => {
        connectingRef.current = false;
        joinedRef.current = false;
        joinSentRef.current = false;
        fatalErrorRef.current = null;
        setPhase('joining');
        setStatusText('Подключаемся…');
        emitJoin();
      });

      socket.on('disconnect', () => {
        joinedRef.current = false;
        joinSentRef.current = false;
        if (fatalErrorRef.current) {
          setPhase('error');
          return;
        }
        setPhase('reconnecting');
        setStatusText('Переподключение…');
      });

      socket.on('connect_error', () => {
        connectingRef.current = false;
        joinedRef.current = false;
        joinSentRef.current = false;
        if (socket.active) {
          clearErrorTimer();
          setPhase('reconnecting');
          setStatusText('Переподключение…');
          return;
        }
        setPhase('error');
        setStatusText('Нет соединения с сервером чата');
      });

      socket.on('reconnect_attempt', () => {
        fatalErrorRef.current = null;
        clearErrorTimer();
        errorTimerRef.current = window.setTimeout(() => {
          if (!joinedRef.current && !fatalErrorRef.current) {
            setPhase('error');
            setStatusText('Нет соединения с сервером чата');
          }
        }, ERROR_AFTER_MS);
        setPhase('reconnecting');
        setStatusText('Переподключение…');
      });

      socket.on('reconnect', () => {
        joinedRef.current = false;
        joinSentRef.current = false;
        emitJoin();
      });

      socket.on('joined', (data: WidgetJoinedEvent) => {
        markReady(data);
      });

      socket.on('error', (data: { code?: string; message?: string }) => {
        joinSentRef.current = false;
        clearJoinRetry();
        callbacksRef.current.onSocketError(data);
        if (data.code === 'origin_not_allowed' || data.code === 'invalid_widget') {
          fatalErrorRef.current = data.message ?? data.code ?? 'error';
          setPhase('error');
          setStatusText(
            data.message ??
              (data.code === 'invalid_widget'
                ? 'Виджет не найден или отключён'
                : 'Домен не разрешён для виджета'),
          );
        } else if (data.code === 'rate_limited') {
          fatalErrorRef.current = data.message ?? 'rate_limited';
          setPhase('error');
          setStatusText(data.message ?? 'Слишком много подключений');
        }
      });

      callbacksRef.current.onSocketReady?.(socket);
      socketRef.current = socket;
    } catch {
      connectingRef.current = false;
      setPhase('error');
      setStatusText('Нет соединения с сервером чата');
    }
  }, [
    apiUrl,
    clearErrorTimer,
    clearJoinRetry,
    emitJoin,
    enabled,
    markReady,
    teardownSocket,
    widgetKey,
  ]);

  const retry = useCallback(() => {
    fatalErrorRef.current = null;
    joinedRef.current = false;
    joinSentRef.current = false;
    setStatusText(null);
    void connect();
  }, [connect]);

  const connectRef = useRef(connect);
  connectRef.current = connect;

  useEffect(() => {
    void prefetchSocketClient();
  }, []);

  useEffect(() => {
    if (!enabled) {
      teardownSocket();
      setPhase('idle');
      setStatusText(null);
      return;
    }
    void connectRef.current();
    return () => {
      teardownSocket();
      setPhase('idle');
      setStatusText(null);
    };
  }, [enabled, widgetKey, apiUrl, teardownSocket]);

  useEffect(() => {
    return () => {
      teardownSocket();
    };
  }, [teardownSocket]);

  useEffect(() => {
    if (!enabled) return;
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      const socket = socketRef.current;
      if (!socket) {
        void connectRef.current();
        return;
      }
      if (!socket.connected) {
        fatalErrorRef.current = null;
        socket.connect();
        return;
      }
      if (!joinedRef.current) {
        joinSentRef.current = false;
        emitJoin();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [enabled, emitJoin]);

  return {
    socketRef,
    phase,
    statusText,
    isReady: phase === 'ready',
    isConnecting: phase === 'connecting' || phase === 'joining' || phase === 'reconnecting',
    retry,
    requestJoin: emitJoin,
  };
}
