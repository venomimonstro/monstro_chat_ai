import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import {
  DEFAULT_SOURCE_CONFIG,
  mergeSourceConfig,
  type SourceConfig,
} from '@ai-consultant/shared-types';
import { COMMON_EMOJIS } from './constants/emojis';
import { useChatScroll } from './hooks/useChatScroll';
import { useSwipeToClose } from './hooks/useSwipeToClose';
import { useViewport, useVisualViewport } from './hooks/useViewport';
import { MessageBubble } from './components/MessageBubble';
import { dedupeMessages } from './utils/messages';
import { generateUuid } from './utils/uuid';
import { prefetchSocketClient } from './utils/prefetchSocket';
import './widget-styles.css';

interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
  createdAt?: string;
}

interface WidgetAttribution {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  referrer?: string;
  landingPage?: string;
  yandexClientId?: string;
  gaClientId?: string;
}

function getAttributionFromParams(params: URLSearchParams): WidgetAttribution {
  const attribution: WidgetAttribution = {};
  for (const [key, param] of [
    ['utmSource', 'utm_source'],
    ['utmMedium', 'utm_medium'],
    ['utmCampaign', 'utm_campaign'],
    ['utmContent', 'utm_content'],
    ['utmTerm', 'utm_term'],
  ] as const) {
    const value = params.get(param);
    if (value) attribution[key] = value;
  }
  const referrer = params.get('referrer');
  const landingPage = params.get('landing_page');
  const yandexClientId = params.get('ym_uid');
  const gaClientId = params.get('ga_cid');
  if (referrer) attribution.referrer = referrer;
  if (landingPage) attribution.landingPage = landingPage;
  if (yandexClientId) attribution.yandexClientId = yandexClientId;
  if (gaClientId) attribution.gaClientId = gaClientId;
  return attribution;
}

function getParams() {
  const params = new URLSearchParams(window.location.search);
  const attribution = getAttributionFromParams(params);
  return {
    widgetKey: params.get('widgetKey') ?? '',
    apiUrl: (params.get('apiUrl') ?? '/api').replace(/\/$/, ''),
    preview: params.get('preview') === '1',
    hostLauncher: params.get('hostLauncher') === '1',
    deferSocket: params.get('preview') !== '1' && params.get('deferSocket') !== '0',
    autoOpen: params.get('autoOpen') === '1',
    attribution:
      Object.keys(attribution).length > 0 ? attribution : undefined,
  };
}

function getSocketOrigin(apiUrl: string): string {
  if (apiUrl.startsWith('/')) return window.location.origin;
  return apiUrl.replace(/\/api\/?$/, '');
}

function safeStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode / blocked storage */
  }
}

function safeStorageRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function getParentOrigin(): string | null {
  const fromAncestors = window.location.ancestorOrigins?.[0];
  if (fromAncestors) return fromAncestors;
  if (!document.referrer) return null;
  try {
    return new URL(document.referrer).origin;
  } catch {
    return null;
  }
}

function isTrustedParentMessage(event: MessageEvent, previewMode: boolean): boolean {
  if (previewMode) return true;
  const parentOrigin = getParentOrigin();
  if (!parentOrigin) return true;
  return event.origin === parentOrigin || event.origin === window.location.origin;
}

function getVisitorId(): string {
  const key = 'aicw_visitor_id';
  let id = safeStorageGet(key);
  if (!id) {
    id = `v_${generateUuid()}`;
    safeStorageSet(key, id);
  }
  return id;
}

function getStoredDialogId(widgetKey: string): string | null {
  return safeStorageGet(`aicw_dialog_${widgetKey}`);
}

function storeDialogId(widgetKey: string, dialogId: string) {
  safeStorageSet(`aicw_dialog_${widgetKey}`, dialogId);
}

function clearStoredDialogId(widgetKey: string) {
  safeStorageRemove(`aicw_dialog_${widgetKey}`);
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function WidgetApp() {
  const { widgetKey, apiUrl, preview, attribution, hostLauncher, deferSocket, autoOpen } =
    useMemo(getParams, []);
  const viewport = useViewport();
  const isMobile = viewport === 'mobile';
  const visualViewport = useVisualViewport();
  const keyboardOpen = isMobile && visualViewport.offsetTop > 0;

  const [config, setConfig] = useState<SourceConfig>(DEFAULT_SOURCE_CONFIG);
  const [open, setOpen] = useState(preview || autoOpen);
  const [pdConsent, setPdConsent] = useState(() =>
    widgetKey ? safeStorageGet(`aicw_pd_consent_${widgetKey}`) === '1' : false,
  );
  const [consentChecked, setConsentChecked] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [dialogId, setDialogId] = useState<string | null>(() =>
    widgetKey ? getStoredDialogId(widgetKey) : null,
  );
  const [isTyping, setIsTyping] = useState(false);
  const [connected, setConnected] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySlow, setHistorySlow] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [latencyHint, setLatencyHint] = useState<number | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const visitorId = useMemo(() => getVisitorId(), []);
  const streamingRef = useRef('');
  const dialogIdRef = useRef<string | null>(dialogId);
  const historyLoadedRef = useRef<string | null>(null);
  const historyMessageIdsRef = useRef<Set<string>>(new Set());
  const messagesLengthRef = useRef(0);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const attributionRef = useRef(attribution);
  const streamFlushRafRef = useRef<number | null>(null);

  useEffect(() => {
    attributionRef.current = attribution;
  }, [attribution]);

  const isStreaming = messages.some((m) => m.streaming);
  const isPending = isTyping || isStreaming;

  const {
    bodyRef,
    contentRef,
    endRef,
    showScrollDown,
    scrollToBottom,
    handleScroll,
  } = useChatScroll({
    open,
    messageCount: messages.length,
    streaming: isStreaming || isTyping,
  });

  const closePanel = useCallback(() => setOpen(false), []);
  const swipeHandlers = useSwipeToClose(closePanel, isMobile && open);

  const notifyParent = useCallback((type: string) => {
    if (window.parent === window) return;
    const target = getParentOrigin() ?? '*';
    window.parent.postMessage({ type }, target);
  }, []);

  useEffect(() => {
    notifyParent('aicw:ready');
  }, [notifyParent]);

  useEffect(() => {
    notifyParent(open ? 'aicw:panel-open' : 'aicw:panel-close');
  }, [open, notifyParent]);

  useEffect(() => {
    dialogIdRef.current = dialogId;
  }, [dialogId]);

  const loadConfig = useCallback(async () => {
    if (!widgetKey) return;
    try {
      const res = await fetch(
        `${apiUrl}/widget/config/${encodeURIComponent(widgetKey)}`,
      );
      const data = await res.json();
      if (data?.config) setConfig(mergeSourceConfig(data.config));
    } catch {
      /* ignore */
    }
  }, [apiUrl, widgetKey]);

  useEffect(() => {
    if (!widgetKey || preview) return;
    loadConfig();
  }, [loadConfig, widgetKey, preview]);

  useEffect(() => {
    if (deferSocket && !open && !preview) return;
    void prefetchSocketClient();
  }, [deferSocket, open, preview]);

  useEffect(() => {
    if (deferSocket && !open && !preview) return;
    if (!widgetKey) return;
    fetch(`${apiUrl}/widget/health`)
      .then((r) => r.json())
      .then((data) => {
        if (typeof data?.latencyHintMs === 'number') {
          setLatencyHint(data.latencyHintMs);
        }
      })
      .catch(() => undefined);
  }, [apiUrl, widgetKey, deferSocket, open, preview]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'aicw:open') {
        setOpen(true);
        return;
      }
      if (event.data?.type === 'aicw:close') {
        setOpen(false);
        setEmojiOpen(false);
        return;
      }
      if (!isTrustedParentMessage(event, preview)) return;
      if (event.data?.type === 'aicw:config' && event.data.config) {
        setConfig(mergeSourceConfig(event.data.config as Partial<SourceConfig>));
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [preview]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        setEmojiOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const panel = panelRef.current;
      if (!panel || panel.contains(event.target as Node)) return;
      setOpen(false);
      setEmojiOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open && pdConsent && !isMobile) {
      inputRef.current?.focus();
    }
  }, [open, pdConsent, isMobile]);

  const adjustTextareaHeight = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }, []);

  const handleInputFocus = useCallback(() => {
    setEmojiOpen(false);
    requestAnimationFrame(() => {
      inputRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      scrollToBottom(false);
    });
  }, [scrollToBottom]);

  useEffect(() => {
    messagesLengthRef.current = messages.length;
  }, [messages.length]);

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--aicw-primary',
      config.appearance.primaryColor,
    );
  }, [config.appearance.primaryColor]);

  const connectSocket = useCallback(async () => {
    if (!widgetKey) return;
    if (socketRef.current?.connected) return;

    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const { io } = await prefetchSocketClient();
    const origin = getSocketOrigin(apiUrl);
    const socket = io(`${origin}/widget`, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 800,
      reconnectionDelayMax: 4000,
    });

    socket.on('connect', () => {
      setConnected(true);
      setConnectionError(false);
      socket.emit('join', {
        widgetKey,
        visitorId,
        dialogId: dialogIdRef.current ?? undefined,
        attribution: attributionRef.current,
      });
    });

    socket.on('disconnect', () => {
      setConnected(false);
      if (streamingRef.current) {
        const partial = streamingRef.current;
        streamingRef.current = '';
        setIsTyping(false);
        setMessages((m) => {
          const copy = [...m];
          const last = copy[copy.length - 1];
          if (last?.streaming) {
            copy[copy.length - 1] = {
              ...last,
              streaming: false,
              content: partial || 'Соединение прервано. Повторите отправку.',
            };
          }
          return copy;
        });
      }
    });

    socket.on('connect_error', () => setConnectionError(true));

    socket.on('joined', () => {
      if (!dialogIdRef.current) {
        setHistoryLoading(false);
      }
    });

    socket.on('history', (data: { dialogId: string; messages: ChatMessage[]; resumed?: boolean }) => {
      setHistoryLoading(false);
      setHistorySlow(false);
      if (
        historyLoadedRef.current === data.dialogId &&
        messagesLengthRef.current > 0
      ) {
        return;
      }
      historyLoadedRef.current = data.dialogId;
      historyMessageIdsRef.current = new Set(
        data.messages.map((msg) => msg.id).filter((id): id is string => Boolean(id)),
      );
      setDialogId(data.dialogId);
      storeDialogId(widgetKey, data.dialogId);
      setMessages(
        dedupeMessages(
          data.messages.map((msg) => ({
            ...msg,
            createdAt: msg.createdAt ?? new Date().toISOString(),
          })),
        ),
      );
      if (data.resumed && data.messages.length > 0) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === '__resume_hint__')) return prev;
          return [
            {
              id: '__resume_hint__',
              role: 'assistant',
              content: 'Продолжаем предыдущий диалог.',
              createdAt: new Date().toISOString(),
            },
            ...prev,
          ];
        });
      }
    });

    socket.on('dialog:created', (data: { dialogId: string }) => {
      setDialogId(data.dialogId);
      storeDialogId(widgetKey, data.dialogId);
    });

    socket.on('stream:start', () => {
      setIsTyping(true);
      streamingRef.current = '';
    });

    socket.on('stream:token', (data: { token: string }) => {
      streamingRef.current += data.token;
      if (streamFlushRafRef.current !== null) return;
      streamFlushRafRef.current = requestAnimationFrame(() => {
        streamFlushRafRef.current = null;
        const content = streamingRef.current;
        setMessages((m) => {
          const copy = [...m];
          const last = copy[copy.length - 1];
          if (last?.streaming) {
            copy[copy.length - 1] = { ...last, content };
          } else {
            copy.push({ role: 'assistant', content, streaming: true });
          }
          return copy;
        });
      });
    });

    socket.on('stream:end', (data: { messageId?: string; content?: string }) => {
      setIsTyping(false);
      const content = data.content ?? streamingRef.current;
      setMessages((m) => {
        const copy = [...m];
        const last = copy[copy.length - 1];
        if (last?.streaming) {
          copy[copy.length - 1] = {
            role: 'assistant',
            content,
            id: data.messageId,
            createdAt: new Date().toISOString(),
          };
        }
        return dedupeMessages(copy);
      });
      streamingRef.current = '';
    });

    socket.on(
      'follow_up:message',
      (data: {
        dialogId: string;
        messageId: string;
        content: string;
        createdAt: string;
      }) => {
        if (data.dialogId) {
          setDialogId(data.dialogId);
          dialogIdRef.current = data.dialogId;
          if (widgetKey) storeDialogId(widgetKey, data.dialogId);
        }
        setMessages((m) =>
          dedupeMessages([
            ...m.filter((msg) => !msg.streaming),
            {
              role: 'assistant',
              content: data.content,
              id: data.messageId,
              createdAt: data.createdAt,
            },
          ]),
        );
        if (!open && !preview) {
          setOpen(true);
        }
      },
    );

    const appendError = (text: string) => {
      setIsTyping(false);
      setMessages((m) =>
        dedupeMessages([
          ...m.filter((msg) => !msg.streaming),
          { role: 'assistant', content: text, createdAt: new Date().toISOString() },
        ]),
      );
    };

    socket.on('stream:error', (data: { error?: string }) => {
      appendError(data.error ?? 'Ошибка при получении ответа');
    });

    socket.on('rate_limited', (data: { message: string }) => {
      appendError(data.message);
    });

    socket.on('limit_exceeded', (data: { message: string }) => {
      appendError(
        data.message ??
          'Лимит сообщений исчерпан. Попробуйте позже или свяжитесь с компанией.',
      );
    });

    socket.on('trial_expired', (data: { message: string }) => {
      appendError(data.message ?? 'Чат временно недоступен. Пробный период закончился.');
    });

    socket.on('tenant_suspended', (data: { message: string }) => {
      appendError(data.message ?? 'Аккаунт приостановлен.');
    });

    socket.on('error', (data: { code?: string }) => {
      if (data.code === 'dialog_not_found' && widgetKey) {
        clearStoredDialogId(widgetKey);
        setDialogId(null);
        dialogIdRef.current = null;
        historyLoadedRef.current = null;
        historyMessageIdsRef.current = new Set();
        setHistoryLoading(false);
        setMessages([]);
      }
    });

    socketRef.current = socket;
  }, [apiUrl, widgetKey, visitorId]);

  useEffect(() => {
    if (deferSocket && !open && !preview) return;

    setHistoryLoading(Boolean(dialogIdRef.current));
    setHistorySlow(false);

    const slowTimeout = window.setTimeout(() => {
      if (historyLoadedRef.current) return;
      setHistorySlow(true);
    }, 1800);

    const historyTimeout = window.setTimeout(() => {
      setHistoryLoading(false);
      if (!historyLoadedRef.current && dialogIdRef.current) {
        setConnectionError(true);
      }
    }, 2500);

    void connectSocket();

    return () => {
      window.clearTimeout(historyTimeout);
      window.clearTimeout(slowTimeout);
    };
  }, [connectSocket, deferSocket, open, preview]);

  useEffect(() => {
    if (deferSocket && !open && !preview) return;

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const socket = socketRef.current;
      if (!socket || socket.connected) return;
      setConnectionError(false);
      socket.connect();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [deferSocket, open, preview]);

  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);

  const { appearance, personalization, behavior } = config;
  const isLeft = appearance.position === 'bottom-left';
  const isDark = appearance.theme === 'dark';
  const quickReplies =
    behavior.quickReplies ?? DEFAULT_SOURCE_CONFIG.behavior?.quickReplies ?? [];

  const quickReplyChips =
    quickReplies.length > 0 ? (
      <div className="aicw-quick-replies" role="list">
        {quickReplies.map((reply) => (
          <button
            key={reply}
            type="button"
            className="aicw-chip"
            onClick={() => sendMessage(reply)}
            disabled={!connected || !pdConsent || isPending}
          >
            {reply}
          </button>
        ))}
      </div>
    ) : null;

  const toggleOpen = () => {
    setOpen((v) => !v);
    setEmojiOpen(false);
  };

  const sendMessage = (text: string) => {
    const trimmed = text.trim();
    if (
      !trimmed ||
      !socketRef.current?.connected ||
      !pdConsent ||
      isPending
    ) {
      return;
    }

    setIsTyping(true);
    setMessages((m) =>
      dedupeMessages([
        ...m,
        {
          role: 'user',
          content: trimmed,
          id: `local-${Date.now()}`,
          createdAt: new Date().toISOString(),
        },
      ]),
    );
    setInput('');
    setEmojiOpen(false);
    requestAnimationFrame(adjustTextareaHeight);

    socketRef.current.emit('message', {
      widgetKey,
      visitorId,
      dialogId: dialogIdRef.current ?? undefined,
      content: trimmed,
      attribution,
    });
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const insertEmoji = (emoji: string) => {
    setInput((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  const panelStyle: React.CSSProperties = isMobile
    ? {
        left: 0,
        right: 0,
        ...(visualViewport.height
          ? {
              top: keyboardOpen ? visualViewport.offsetTop : undefined,
              bottom: keyboardOpen ? undefined : 0,
              height: `${visualViewport.height}px`,
              maxHeight: `${visualViewport.height}px`,
            }
          : { bottom: 0 }),
      }
    : {
        [isLeft ? 'left' : 'right']: appearance.offsetX,
        bottom: appearance.offsetY + 60,
      };

  const header = (
    <div
      className="aicw-header"
      style={{ background: appearance.primaryColor, color: appearance.textColor }}
      {...swipeHandlers}
    >
      {isMobile && <div className="aicw-swipe-handle" aria-hidden />}
      <div className="aicw-avatar">
        {appearance.avatarUrl || personalization.managerPhotoUrl ? (
          <img src={appearance.avatarUrl || personalization.managerPhotoUrl} alt="" />
        ) : (
          <div className="aicw-avatar-placeholder">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden>
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
            </svg>
          </div>
        )}
        <span className={`aicw-status-dot ${connected ? 'online' : ''}`} />
      </div>
      <div className="aicw-header-info">
        <div className="aicw-manager-name">{personalization.managerName}</div>
        <div className="aicw-status-text">
          {connected
            ? latencyHint !== null
              ? `Онлайн · ~${latencyHint} мс`
              : 'Онлайн'
            : historySlow
              ? 'Подключаемся…'
              : 'Подключение…'}
        </div>
      </div>
      <button
        type="button"
        className="aicw-close"
        onClick={closePanel}
        aria-label="Закрыть чат"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );

  const privacyHref = useMemo(() => {
    const parent = getParentOrigin();
    if (parent) return `${parent}/legal/privacy`;
    return '/legal/privacy';
  }, []);

  const consentScreen = (
    <div className={`aicw-consent ${isDark ? 'dark' : ''}`}>
      <p className="aicw-consent-title">Перед началом диалога</p>
      <p className="aicw-consent-text">
        Подтвердите согласие на обработку персональных данных.
      </p>
      <label className="aicw-consent-label">
        <input
          type="checkbox"
          checked={consentChecked}
          onChange={(e) => setConsentChecked(e.target.checked)}
        />
        <span>
          Я согласен(на) на обработку персональных данных и принимаю{' '}
          <a href={privacyHref} target="_blank" rel="noreferrer" className="aicw-link">
            политику конфиденциальности
          </a>
        </span>
      </label>
      <button
        type="button"
        disabled={!consentChecked}
        className="aicw-consent-btn"
        style={{ background: appearance.primaryColor, color: appearance.textColor }}
        onClick={() => {
          setPdConsent(true);
          if (widgetKey) safeStorageSet(`aicw_pd_consent_${widgetKey}`, '1');
        }}
      >
        Начать диалог
      </button>
    </div>
  );

  const renderMessages = () => {
    if (historyLoading && messages.length === 0) {
      return (
        <div className="aicw-loading" aria-busy="true" aria-label="Загрузка истории">
          <div className="aicw-loading-spinner" aria-hidden />
          <p className="aicw-loading-text">
            {historySlow ? 'Подключаемся к серверу…' : 'Загрузка переписки…'}
          </p>
        </div>
      );
    }

    return (
      <>
        <div ref={contentRef} className="aicw-messages-flow">
        <div className={`aicw-welcome ${isDark ? 'dark' : ''}`}>
          {personalization.welcomeMessage}
        </div>
        {messages.length === 0 && quickReplyChips}
        {messages.map((msg, i) => {
          const isUser = msg.role === 'user';
          const showAvatar = !isUser && (i === 0 || messages[i - 1]?.role === 'user');
          const time = msg.createdAt ? formatTime(new Date(msg.createdAt)) : '';
          const isNewMessage =
            msg.id !== '__resume_hint__' &&
            (!msg.id || !historyMessageIdsRef.current.has(msg.id));
          return (
            <div
              key={msg.id ?? `msg-${i}`}
              className={`aicw-message ${isUser ? 'user' : 'assistant'} ${isDark ? 'dark' : ''}${isNewMessage ? ' aicw-new' : ''}`}
              role="listitem"
            >
              {!isUser && showAvatar && (
                <div className="aicw-message-avatar">
                  {appearance.avatarUrl || personalization.managerPhotoUrl ? (
                    <img src={appearance.avatarUrl || personalization.managerPhotoUrl} alt="" />
                  ) : (
                    <div className="aicw-message-avatar-placeholder">
                      {personalization.managerName[0]}
                    </div>
                  )}
                </div>
              )}
              <div className="aicw-message-content">
                <MessageBubble
                  content={msg.content}
                  streaming={msg.streaming}
                  isUser={isUser}
                  isDark={isDark}
                  primaryColor={appearance.primaryColor}
                  textColor={appearance.textColor}
                />
                {time && <div className="aicw-message-time">{time}</div>}
              </div>
            </div>
          );
        })}
        {isTyping && !messages.some((m) => m.streaming) && (
          <div className={`aicw-typing ${isDark ? 'dark' : ''}`} aria-label="Печатает">
            <span className="aicw-typing-dot" />
            <span className="aicw-typing-dot" />
            <span className="aicw-typing-dot" />
            <span className="aicw-typing-text">печатает</span>
          </div>
        )}
        {connectionError && !connected && (
          <div className="aicw-error-banner" role="alert">
            Нет соединения.{' '}
            <button
              type="button"
              className="aicw-retry-link"
              onClick={() => {
                setConnectionError(false);
                if (socketRef.current) {
                  socketRef.current.removeAllListeners();
                  socketRef.current.disconnect();
                  socketRef.current = null;
                }
                void connectSocket();
              }}
            >
              Повторить
            </button>
          </div>
        )}
        </div>
        <div ref={endRef} />
      </>
    );
  };

  const footer = pdConsent && (
    <div className={`aicw-footer ${isDark ? 'dark' : ''}`}>
      {emojiOpen && (
        <div className={`aicw-emoji-picker ${isDark ? 'dark' : ''}`} role="listbox" aria-label="Эмодзи">
          {COMMON_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="aicw-emoji-btn"
              onClick={() => insertEmoji(emoji)}
              aria-label={`Эмодзи ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
      <div className="aicw-input-wrap">
        <button
          type="button"
          className="aicw-attach-btn"
          disabled
          title="Загрузка файлов — скоро"
          aria-label="Прикрепить файл (скоро)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
          </svg>
        </button>
        <button
          type="button"
          className={`aicw-emoji-toggle ${emojiOpen ? 'active' : ''}`}
          onClick={() => setEmojiOpen((v) => !v)}
          aria-label="Выбрать эмодзи"
          aria-expanded={emojiOpen}
        >
          😊
        </button>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            adjustTextareaHeight();
          }}
          onKeyDown={handleInputKeyDown}
          onFocus={handleInputFocus}
          placeholder={
            !connected
              ? 'Подключение…'
              : isPending
                ? 'Ожидайте ответ…'
                : personalization.inputPlaceholder
          }
          disabled={!connected || !pdConsent || isPending}
          aria-label="Сообщение"
          className="aicw-input"
          rows={1}
          enterKeyHint="send"
          inputMode="text"
        />
        <button
          type="button"
          onClick={() => sendMessage(input)}
          disabled={!connected || !pdConsent || !input.trim() || isPending}
          aria-label="Отправить"
          className="aicw-send"
          style={{ background: appearance.primaryColor, color: appearance.textColor }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
        </button>
      </div>
    </div>
  );

  const panel = (
    <div
      ref={panelRef}
      id="aicw-chat-panel"
      role="dialog"
      aria-modal="false"
      aria-label="Чат с поддержкой"
      className={`aicw-panel ${open ? 'open' : ''} aicw-${viewport} ${isDark ? 'dark' : ''} ${isLeft ? 'left' : 'right'} ${keyboardOpen ? 'aicw-keyboard-open' : ''}`}
      style={panelStyle}
    >
      {header}
      <div className="aicw-panel-inner">
        <div className="aicw-chat-main">
          <div
            ref={bodyRef}
            className={`aicw-body ${isDark ? 'dark' : ''}`}
            onScroll={handleScroll}
            role="log"
            aria-live="polite"
            aria-relevant="additions"
          >
            {!pdConsent ? consentScreen : renderMessages()}
            {showScrollDown && pdConsent && (
              <button
                type="button"
                className="aicw-scroll-down"
                onClick={() => scrollToBottom()}
                aria-label="Прокрутить вниз"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M12 5v14M5 12l7 7 7-7" />
                </svg>
              </button>
            )}
          </div>
          {footer}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {panel}
      {!hostLauncher && (
      <div
        className={`aicw-button-wrap ${isLeft ? 'left' : 'right'}`}
        style={{
          [isLeft ? 'left' : 'right']: appearance.offsetX,
          bottom: appearance.offsetY,
          display: appearance.hideOnMobile && isMobile ? 'none' : 'flex',
        }}
      >
        <button
          type="button"
          className={`aicw-button ${appearance.buttonShape === 'round' ? 'round' : 'square'} ${open ? 'open' : ''}`}
          style={{
            background: appearance.primaryColor,
            color: appearance.textColor,
          }}
          onClick={toggleOpen}
          aria-label={open ? 'Закрыть чат' : 'Открыть чат'}
          aria-expanded={open}
          aria-controls="aicw-chat-panel"
        >
          {open ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="aicw-icon" aria-hidden>
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="aicw-icon" aria-hidden>
              <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          )}
        </button>
      </div>
      )}
    </>
  );
}
