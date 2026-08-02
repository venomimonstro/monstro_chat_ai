import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import {
  DEFAULT_SOURCE_CONFIG,
  type SourceConfig,
} from '@ai-consultant/shared-types';
import { COMMON_EMOJIS } from './constants/emojis';
import { useChatScroll } from './hooks/useChatScroll';
import { useSwipeToClose } from './hooks/useSwipeToClose';
import { useViewport, useVisualViewportHeight } from './hooks/useViewport';
import { dedupeMessages } from './utils/messages';
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

function getVisitorId(): string {
  const key = 'aicw_visitor_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = `v_${crypto.randomUUID()}`;
    localStorage.setItem(key, id);
  }
  return id;
}

function getStoredDialogId(widgetKey: string): string | null {
  return localStorage.getItem(`aicw_dialog_${widgetKey}`);
}

function storeDialogId(widgetKey: string, dialogId: string) {
  localStorage.setItem(`aicw_dialog_${widgetKey}`, dialogId);
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function WidgetApp() {
  const { widgetKey, apiUrl, preview, attribution, hostLauncher, deferSocket, autoOpen } =
    useMemo(getParams, []);
  const viewport = useViewport();
  const visualHeight = useVisualViewportHeight();
  const isMobile = viewport === 'mobile';
  const isDesktop = viewport === 'desktop';

  const [config, setConfig] = useState<SourceConfig>(DEFAULT_SOURCE_CONFIG);
  const [open, setOpen] = useState(preview || autoOpen);
  const [pdConsent, setPdConsent] = useState(() =>
    localStorage.getItem(`aicw_pd_consent_${widgetKey}`) === '1',
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
  const [connectionError, setConnectionError] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [latencyHint, setLatencyHint] = useState<number | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const visitorId = useMemo(() => getVisitorId(), []);
  const streamingRef = useRef('');
  const dialogIdRef = useRef<string | null>(dialogId);
  const historyLoadedRef = useRef<string | null>(null);
  const messagesLengthRef = useRef(0);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const {
    bodyRef,
    endRef,
    showScrollDown,
    scrollToBottom,
    handleScroll,
  } = useChatScroll([messages, isTyping, open]);

  const closePanel = useCallback(() => setOpen(false), []);
  const swipeHandlers = useSwipeToClose(closePanel, isMobile && open);

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
      if (data?.config) setConfig(data.config);
    } catch {
      /* ignore */
    }
  }, [apiUrl, widgetKey]);

  useEffect(() => {
    if (deferSocket && !open && !preview) return;
    loadConfig();
    const interval = setInterval(loadConfig, 4000);
    return () => clearInterval(interval);
  }, [loadConfig, deferSocket, open, preview]);

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
      const parentOrigin = window.location.ancestorOrigins?.[0] ?? document.referrer;
      if (parentOrigin && event.origin !== parentOrigin && event.origin !== '*') return;
      if (event.data?.type === 'aicw:config' && event.data.config) {
        setConfig(event.data.config as SourceConfig);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

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
    if (open && pdConsent) {
      inputRef.current?.focus();
    }
  }, [open, pdConsent]);

  useEffect(() => {
    messagesLengthRef.current = messages.length;
  }, [messages.length]);

  const connectSocket = useCallback(async () => {
    if (!widgetKey || socketRef.current?.connected) return;

    const { io } = await import('socket.io-client');
    const origin = getSocketOrigin(apiUrl);
    const socket = io(`${origin}/widget`, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      setConnected(true);
      setConnectionError(false);
      socket.emit('join', {
        widgetKey,
        visitorId,
        dialogId: dialogIdRef.current ?? undefined,
        attribution,
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

    socket.on('history', (data: { dialogId: string; messages: ChatMessage[] }) => {
      setHistoryLoading(false);
      if (
        historyLoadedRef.current === data.dialogId &&
        messagesLengthRef.current > 0
      ) {
        return;
      }
      historyLoadedRef.current = data.dialogId;
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
    });

    socket.on('dialog:created', (data: { dialogId: string }) => {
      setDialogId(data.dialogId);
      storeDialogId(widgetKey, data.dialogId);
    });

    socket.on('stream:start', () => {
      setIsTyping(true);
      streamingRef.current = '';
      setMessages((m) => {
        if (m.some((msg) => msg.streaming)) return m;
        return [...m, { role: 'assistant', content: '', streaming: true }];
      });
    });

    socket.on('stream:token', (data: { token: string }) => {
      streamingRef.current += data.token;
      const content = streamingRef.current;
      setMessages((m) => {
        const copy = [...m];
        const last = copy[copy.length - 1];
        if (last?.streaming) {
          copy[copy.length - 1] = { ...last, content };
        }
        return copy;
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

    socketRef.current = socket;
  }, [apiUrl, widgetKey, visitorId, attribution]);

  useEffect(() => {
    if (socketRef.current?.connected && widgetKey) {
      socketRef.current.emit('join', {
        widgetKey,
        visitorId,
        dialogId: dialogIdRef.current ?? undefined,
        attribution,
      });
    }
  }, [dialogId, widgetKey, visitorId, attribution]);

  useEffect(() => {
    if (deferSocket && !open && !preview) return;

    setHistoryLoading(true);
    void connectSocket();

    return () => {
      if (deferSocket) {
        socketRef.current?.disconnect();
        socketRef.current = null;
        setConnected(false);
      }
    };
  }, [connectSocket, deferSocket, open, preview]);

  const { appearance, personalization, behavior } = config;
  const isLeft = appearance.position === 'bottom-left';
  const isDark = appearance.theme === 'dark';
  const quickReplies =
    behavior.quickReplies ?? DEFAULT_SOURCE_CONFIG.behavior?.quickReplies ?? [];

  const toggleOpen = () => {
    setOpen((v) => !v);
    setEmojiOpen(false);
  };

  const sendMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !socketRef.current?.connected || !pdConsent) return;

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

  const panelStyle: React.CSSProperties = {
    [isLeft ? 'left' : 'right']: isMobile ? 12 : appearance.offsetX,
    bottom: isMobile ? appearance.offsetY + 68 : appearance.offsetY + 68,
    ...(isMobile && visualHeight
      ? {
          maxHeight: `${Math.min(visualHeight - appearance.offsetY - 80, 520)}px`,
        }
      : {}),
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

  const faqSidebar =
    isDesktop && quickReplies.length > 0 ? (
      <aside className={`aicw-faq-sidebar ${isDark ? 'dark' : ''}`} aria-label="Частые вопросы">
        <p className="aicw-faq-title">Частые вопросы</p>
        <ul className="aicw-faq-list">
          {quickReplies.map((reply) => (
            <li key={reply}>
              <button
                type="button"
                className="aicw-faq-item"
                onClick={() => sendMessage(reply)}
                disabled={!connected || !pdConsent}
              >
                {reply}
              </button>
            </li>
          ))}
        </ul>
      </aside>
    ) : null;

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
          <a href="/legal/privacy" target="_blank" rel="noreferrer" className="aicw-link">
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
          if (widgetKey) localStorage.setItem(`aicw_pd_consent_${widgetKey}`, '1');
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
          <div className="aicw-skeleton aicw-skeleton-line short" />
          <div className="aicw-skeleton aicw-skeleton-line" />
          <div className="aicw-skeleton aicw-skeleton-line short" />
        </div>
      );
    }

    return (
      <>
        <div className={`aicw-welcome ${isDark ? 'dark' : ''}`}>
          {personalization.welcomeMessage}
        </div>
        {!isDesktop && messages.length === 0 && quickReplies.length > 0 && (
          <div className="aicw-quick-replies" role="list">
            {quickReplies.map((reply) => (
              <button
                key={reply}
                type="button"
                className="aicw-chip"
                onClick={() => sendMessage(reply)}
                disabled={!connected || !pdConsent}
              >
                {reply}
              </button>
            ))}
          </div>
        )}
        {messages.map((msg, i) => {
          const isUser = msg.role === 'user';
          const showAvatar = !isUser && (i === 0 || messages[i - 1]?.role === 'user');
          const time = msg.createdAt ? formatTime(new Date(msg.createdAt)) : '';
          return (
            <div
              key={msg.id ?? `msg-${i}`}
              className={`aicw-message ${isUser ? 'user' : 'assistant'} ${isDark ? 'dark' : ''}`}
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
                <div
                  className="aicw-bubble"
                  style={
                    isUser
                      ? { background: appearance.primaryColor, color: appearance.textColor }
                      : undefined
                  }
                >
                  {msg.content}
                  {msg.streaming && <span className="aicw-cursor" aria-hidden>▍</span>}
                </div>
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
                connectSocket();
              }}
            >
              Повторить
            </button>
          </div>
        )}
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
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder={connected ? personalization.inputPlaceholder : 'Подключение…'}
          disabled={!connected || !pdConsent}
          aria-label="Сообщение"
          className="aicw-input"
          rows={1}
        />
        <button
          type="button"
          onClick={() => sendMessage(input)}
          disabled={!connected || !pdConsent || !input.trim()}
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
      role="dialog"
      aria-modal="true"
      aria-label="Чат с поддержкой"
      className={`aicw-panel ${open ? 'open' : ''} aicw-${viewport} ${isDark ? 'dark' : ''} ${isLeft ? 'left' : 'right'}`}
      style={panelStyle}
    >
      {header}
      <div className="aicw-panel-inner">
        {faqSidebar}
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
