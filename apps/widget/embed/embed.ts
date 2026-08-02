type InitOptions = {
  widgetKey: string;
  apiUrl?: string;
  widgetUrl?: string;
  lazyLoad?: boolean;
  primaryColor?: string;
  position?: 'bottom-right' | 'bottom-left';
};

type QueuedCall = [string, ...unknown[]];

declare global {
  interface Window {
    aicw?: AicwApi;
    AIConsultantWidget?: string;
  }
}

interface AicwApi {
  (...args: QueuedCall): void;
  q?: QueuedCall[];
  _initialized?: boolean;
}

(function bootstrap() {
  const API_NAME = 'aicw';
  const win = window as Window;

  if (!win[API_NAME as 'aicw']) {
    const api = function (...args: QueuedCall) {
      (api.q = api.q || []).push(args);
    } as AicwApi;
    win[API_NAME as 'aicw'] = api;
    win.AIConsultantWidget = API_NAME;
  }

  const script =
    (document.getElementById('aicw') as HTMLScriptElement | null) ??
    (document.currentScript as HTMLScriptElement | null);
  const scriptSrc = script?.src ?? '';
  const baseUrl = scriptSrc.replace(/\/embed\.js.*$/, '');

  let iframe: HTMLIFrameElement | null = null;
  let launcherBtn: HTMLButtonElement | null = null;
  let configPollTimer: ReturnType<typeof setInterval> | null = null;
  let lastConfigVersion = -1;
  let state: InitOptions | null = null;
  let lazyLoadEnabled = true;
  let preconnected = false;
  let interactionCleanups: Array<() => void> = [];

  function getApiUrl(opts: InitOptions): string {
    return (opts.apiUrl ?? deriveApiUrl(scriptSrc)).replace(/\/$/, '');
  }

  function getWidgetUrl(opts: InitOptions): string {
    const raw = (opts.widgetUrl ?? `${baseUrl}/iframe`).replace(/\/$/, '');
    if (raw.endsWith('/iframe')) return raw;
    return `${raw}/iframe`;
  }

  function deriveApiUrl(src: string): string {
    try {
      const url = new URL(src);
      return `${url.protocol}//${url.hostname}:3000/api`;
    } catch {
      return '/api';
    }
  }

  function getCookie(name: string): string | undefined {
    const match = document.cookie.match(
      new RegExp('(?:^|; )' + name.replace(/[$()*+./?[\\\]^{|}-]/g, '\\$&') + '=([^;]*)'),
    );
    return match ? decodeURIComponent(match[1]) : undefined;
  }

  function getGaClientId(): string | undefined {
    const ga = getCookie('_ga');
    if (!ga) return undefined;
    const parts = ga.split('.');
    if (parts.length >= 4) return `${parts[2]}.${parts[3]}`;
    return ga;
  }

  function buildAttributionQuery(): string {
    const params = new URLSearchParams(location.search);
    const qs = new URLSearchParams();
    for (const key of [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_content',
      'utm_term',
    ]) {
      const value = params.get(key);
      if (value) qs.set(key, value);
    }
    if (document.referrer) qs.set('referrer', document.referrer);
    qs.set('landing_page', location.href);
    const ymUid = getCookie('_ym_uid');
    if (ymUid) qs.set('ym_uid', ymUid);
    const gaCid = getGaClientId();
    if (gaCid) qs.set('ga_cid', gaCid);
    return qs.toString() ? `&${qs.toString()}` : '';
  }

  function preconnectOrigins(opts: InitOptions) {
    if (preconnected) return;
    preconnected = true;
    const origins = new Set<string>();
    try {
      origins.add(new URL(getWidgetUrl(opts)).origin);
    } catch {
      /* ignore */
    }
    try {
      const api = getApiUrl(opts);
      origins.add(api.startsWith('/') ? location.origin : new URL(api).origin);
    } catch {
      /* ignore */
    }
    for (const href of origins) {
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = href;
      document.head.appendChild(link);
    }
  }

  function removeLauncher() {
    launcherBtn?.remove();
    launcherBtn = null;
  }

  function createLauncher(opts: InitOptions) {
    if (launcherBtn) return;
    const color = opts.primaryColor ?? '#2563eb';
    const isLeft = opts.position === 'bottom-left';
    launcherBtn = document.createElement('button');
    launcherBtn.type = 'button';
    launcherBtn.setAttribute('aria-label', 'Открыть чат');
    launcherBtn.setAttribute('aria-expanded', 'false');
    launcherBtn.id = 'aicw-launcher';
    launcherBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>';
    Object.assign(launcherBtn.style, {
      position: 'fixed',
      bottom: '20px',
      [isLeft ? 'left' : 'right']: '20px',
      width: '56px',
      height: '56px',
      borderRadius: '50%',
      border: 'none',
      cursor: 'pointer',
      zIndex: '2147483647',
      background: color,
      color: '#fff',
      boxShadow: '0 4px 14px rgba(0,0,0,.18)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0',
    });
    const svg = launcherBtn.querySelector('svg');
    if (svg) {
      Object.assign((svg as SVGElement).style, { width: '26px', height: '26px' });
    }
    launcherBtn.addEventListener('mouseenter', () => preconnectOrigins(opts), {
      once: true,
    });
    launcherBtn.addEventListener('focus', () => preconnectOrigins(opts), {
      once: true,
    });
    launcherBtn.addEventListener('click', () => activateWidget(opts, true));
    document.body.appendChild(launcherBtn);
  }

  function loadIframe(opts: InitOptions, autoOpen = false) {
    if (iframe) {
      if (autoOpen) {
        iframe.contentWindow?.postMessage({ type: 'aicw:open' }, '*');
      }
      return;
    }
    const widgetUrl = getWidgetUrl(opts);
    const flags = autoOpen
      ? '&hostLauncher=1&deferSocket=1&autoOpen=1'
      : '&deferSocket=1';
    iframe = document.createElement('iframe');
    iframe.src = `${widgetUrl}/index.html?widgetKey=${encodeURIComponent(opts.widgetKey)}&apiUrl=${encodeURIComponent(getApiUrl(opts))}${flags}${buildAttributionQuery()}`;
    iframe.title = 'AI Consultant Chat';
    iframe.style.cssText =
      'position:fixed;border:none;z-index:2147483646;width:100%;height:100%;top:0;left:0;background:transparent;pointer-events:none;';
    iframe.setAttribute('allow', 'clipboard-write');
    iframe.setAttribute('loading', 'lazy');
    document.body.appendChild(iframe);

    iframe.onload = () => {
      if (iframe?.contentWindow) {
        iframe.style.pointerEvents = 'auto';
        if (autoOpen) {
          iframe.contentWindow.postMessage({ type: 'aicw:open' }, '*');
        }
      }
    };
  }

  function scheduleLoad(opts: InitOptions) {
    const run = () => loadIframe(opts, false);
    if ('requestIdleCallback' in window) {
      (
        window as Window & {
          requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void;
        }
      ).requestIdleCallback(run, { timeout: 3000 });
    } else {
      setTimeout(run, 1);
    }
  }

  function ping(apiUrl: string, widgetKey: string) {
    fetch(`${apiUrl}/widget/ping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ widgetKey, pageUrl: location.href }),
    }).catch(() => undefined);
  }

  function pollConfig(apiUrl: string, widgetKey: string) {
    fetch(`${apiUrl}/widget/config/version/${encodeURIComponent(widgetKey)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data || data.configVersion === lastConfigVersion) return;
        lastConfigVersion = data.configVersion;
        fetch(`${apiUrl}/widget/config/${encodeURIComponent(widgetKey)}`)
          .then((r) => r.json())
          .then((configData) => {
            if (!configData?.config) return;
            const targetOrigin = iframe?.src ? new URL(iframe.src).origin : '*';
            iframe?.contentWindow?.postMessage(
              {
                type: 'aicw:config',
                config: configData.config,
                configVersion: data.configVersion,
              },
              targetOrigin,
            );
          })
          .catch(() => undefined);
      })
      .catch(() => undefined);
  }

  function startConfigPolling(apiUrl: string, widgetKey: string) {
    pollConfig(apiUrl, widgetKey);
    if (configPollTimer) clearInterval(configPollTimer);
    configPollTimer = setInterval(() => pollConfig(apiUrl, widgetKey), 4000);
  }

  function startNetworkActivity(opts: InitOptions) {
    const apiUrl = getApiUrl(opts);
    ping(apiUrl, opts.widgetKey);
    startConfigPolling(apiUrl, opts.widgetKey);
  }

  function activateWidget(opts: InitOptions, fromUser = false) {
    preconnectOrigins(opts);
    removeLauncher();
    if (lazyLoadEnabled && fromUser) {
      startNetworkActivity(opts);
    }
    loadIframe(opts, fromUser);
  }

  function registerInteractionFallback(opts: InitOptions) {
    const onInteraction = () => {
      scheduleLoad(opts);
      cleanupInteractions();
    };
    const optsOnce = { once: true, passive: true } as AddEventListenerOptions;
    document.addEventListener('mousemove', onInteraction, optsOnce);
    document.addEventListener('scroll', onInteraction, optsOnce);
    document.addEventListener('touchstart', onInteraction, optsOnce);
    interactionCleanups.push(() => {
      document.removeEventListener('mousemove', onInteraction);
      document.removeEventListener('scroll', onInteraction);
      document.removeEventListener('touchstart', onInteraction);
    });
  }

  function cleanupInteractions() {
    for (const fn of interactionCleanups) fn();
    interactionCleanups = [];
  }

  function handleInit(opts: InitOptions) {
    if (!opts?.widgetKey) return;
    state = opts;
    lazyLoadEnabled = opts.lazyLoad !== false;

    if (lazyLoadEnabled) {
      createLauncher(opts);
      return;
    }

    startNetworkActivity(opts);
    registerInteractionFallback(opts);
    scheduleLoad(opts);
  }

  function handleDestroy() {
    cleanupInteractions();
    if (configPollTimer) {
      clearInterval(configPollTimer);
      configPollTimer = null;
    }
    iframe?.remove();
    iframe = null;
    removeLauncher();
    state = null;
    lastConfigVersion = -1;
    preconnected = false;
  }

  function processQueue() {
    const api = win.aicw;
    if (!api?.q) return;
    const queue = [...api.q];
    api.q = [];
    for (const args of queue) {
      dispatch(args);
    }
  }

  function dispatch(args: QueuedCall) {
    const [cmd, payload] = args;
    if (cmd === 'init') handleInit(payload as InitOptions);
    if (cmd === 'open' && state) activateWidget(state, true);
    if (cmd === 'destroy') handleDestroy();
  }

  const api = win.aicw!;
  const wrapped = function (...args: QueuedCall) {
    dispatch(args);
  } as AicwApi;
  wrapped.q = api.q;
  win.aicw = wrapped;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', processQueue);
  } else {
    processQueue();
  }
})();
