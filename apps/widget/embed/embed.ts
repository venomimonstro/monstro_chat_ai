import {
  armConversionTriggers,
  markTriggerEngaged,
  type ConversionTriggerBehavior,
} from './conversion-triggers';

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
  let triggerCleanup: (() => void) | null = null;

  function triggerStorageKey(widgetKey: string) {
    return `aicw_trigger_${widgetKey}`;
  }

  function rewriteLocalhostApiUrl(url: string): string {
    try {
      const parsed = new URL(url);
      const pageHost = location.hostname;
      if (
        (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') &&
        pageHost &&
        pageHost !== 'localhost' &&
        pageHost !== '127.0.0.1'
      ) {
        parsed.hostname = pageHost;
        return parsed.toString().replace(/\/$/, '');
      }
    } catch {
      /* ignore */
    }
    return url.replace(/\/$/, '');
  }

  function getApiUrl(opts: InitOptions): string {
    const raw = opts.apiUrl ?? deriveApiUrl(scriptSrc);
    return rewriteLocalhostApiUrl(raw);
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

  function setIframeInteractivity(active: boolean) {
    if (iframe) {
      iframe.style.pointerEvents = active ? 'auto' : 'none';
    }
  }

  function removeLauncher() {
    launcherBtn?.remove();
    launcherBtn = null;
  }

  function createLauncher(opts: InitOptions) {
    if (launcherBtn) return;
    const color = opts.primaryColor ?? '#EF2B34';
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
      bottom: '16px',
      [isLeft ? 'left' : 'right']: '16px',
      width: '48px',
      height: '48px',
      borderRadius: '50%',
      border: 'none',
      cursor: 'pointer',
      zIndex: '2147483647',
      background: color,
      color: '#fff',
      boxShadow: '0 6px 20px rgba(239,43,52,.28)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0',
    });
    const svg = launcherBtn.querySelector('svg');
    if (svg) {
      Object.assign((svg as SVGElement).style, { width: '22px', height: '22px' });
    }
    launcherBtn.addEventListener('mouseenter', () => preconnectOrigins(opts), {
      once: true,
    });
    launcherBtn.addEventListener('focus', () => preconnectOrigins(opts), {
      once: true,
    });
    launcherBtn.addEventListener('click', () => activateWidget(opts, true, { manual: true }));
    document.body.appendChild(launcherBtn);
  }

  function isFromWidgetIframe(event: MessageEvent): boolean {
    return Boolean(iframe?.contentWindow && event.source === iframe.contentWindow);
  }

  function setupMessageBridge() {
    window.addEventListener('message', (event: MessageEvent) => {
      if (!isFromWidgetIframe(event) || !state) return;
      const type = event.data?.type;
      if (type === 'aicw:panel-open') {
        setIframeInteractivity(true);
        removeLauncher();
        window.dispatchEvent(new Event('aicw:opened'));
      }
      if (type === 'aicw:panel-close') {
        setIframeInteractivity(false);
        window.dispatchEvent(new Event('aicw:closed'));
        if (lazyLoadEnabled && state) {
          createLauncher(state);
        }
      }
    });
  }

  function finalizeOpen() {
    removeLauncher();
    window.dispatchEvent(new Event('aicw:opened'));
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
    iframe.title = 'RedFlow Chat';
    iframe.style.cssText =
      'position:fixed;border:none;z-index:2147483646;width:100%;height:100%;top:0;left:0;background:transparent;pointer-events:none;';
    iframe.setAttribute('allow', 'clipboard-write');
    if (!autoOpen) {
      iframe.setAttribute('loading', 'lazy');
    }
    document.body.appendChild(iframe);

    let openFallbackTimer: ReturnType<typeof setTimeout> | null = null;

    iframe.onload = () => {
      if (!iframe?.contentWindow) return;
      if (autoOpen) {
        iframe.contentWindow.postMessage({ type: 'aicw:open' }, '*');
        openFallbackTimer = setTimeout(finalizeOpen, 600);
      }
    };

    if (autoOpen) {
      window.addEventListener('message', function onReady(event: MessageEvent) {
        if (!isFromWidgetIframe(event)) return;
        if (event.data?.type === 'aicw:panel-open') {
          if (openFallbackTimer) clearTimeout(openFallbackTimer);
          finalizeOpen();
          window.removeEventListener('message', onReady);
        }
      });
    }
  }

  function scheduleLoad(opts: InitOptions) {
    loadIframe(opts, false);
  }

  function ping(apiUrl: string, widgetKey: string) {
    fetch(`${apiUrl}/widget/ping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ widgetKey, pageUrl: location.href }),
    }).catch(() => undefined);
  }

  function updateLauncherFromConfig(config: { appearance?: { primaryColor?: string } }) {
    const color = config.appearance?.primaryColor;
    if (!color || !launcherBtn) return;
    launcherBtn.style.background = color;
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
            updateLauncherFromConfig(configData.config);
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
    configPollTimer = setInterval(() => pollConfig(apiUrl, widgetKey), 30000);
  }

  function startNetworkActivity(opts: InitOptions) {
    const apiUrl = getApiUrl(opts);
    ping(apiUrl, opts.widgetKey);
    startConfigPolling(apiUrl, opts.widgetKey);
  }

  function activateWidget(
    opts: InitOptions,
    openPanel = false,
    opts2?: { manual?: boolean },
  ) {
    preconnectOrigins(opts);
    const manual = opts2?.manual === true;
    if (manual) {
      launcherBtn?.setAttribute('aria-expanded', 'true');
      markTriggerEngaged(triggerStorageKey(opts.widgetKey));
      if (triggerCleanup) {
        triggerCleanup();
        triggerCleanup = null;
      }
    } else if (openPanel && triggerCleanup) {
      triggerCleanup();
      triggerCleanup = null;
    }
    if (lazyLoadEnabled && openPanel) {
      startNetworkActivity(opts);
    }
    loadIframe(opts, openPanel);
  }

  function setupConversionTriggers(opts: InitOptions) {
    if (triggerCleanup) {
      triggerCleanup();
      triggerCleanup = null;
    }

    const apiUrl = getApiUrl(opts);
    fetch(`${apiUrl}/widget/config/${encodeURIComponent(opts.widgetKey)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data?.config || state?.widgetKey !== opts.widgetKey) return;

        updateLauncherFromConfig(data.config);

        const behavior = (data.config.behavior ?? {}) as ConversionTriggerBehavior;
        const hideOnMobile = data.config.appearance?.hideOnMobile === true;

        triggerCleanup = armConversionTriggers(
          behavior,
          {
            storageKey: triggerStorageKey(opts.widgetKey),
            hideOnMobile,
            isMobile: () => window.matchMedia('(max-width: 768px)').matches,
          },
          () => activateWidget(opts, true),
        );
      })
      .catch(() => undefined);
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
      setupConversionTriggers(opts);
      return;
    }

    startNetworkActivity(opts);
    registerInteractionFallback(opts);
    scheduleLoad(opts);
    setupConversionTriggers(opts);
  }

  function handleDestroy() {
    cleanupInteractions();
    if (triggerCleanup) {
      triggerCleanup();
      triggerCleanup = null;
    }
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
    if (cmd === 'open' && state) activateWidget(state, true, { manual: true });
    if (cmd === 'close') {
      iframe?.contentWindow?.postMessage({ type: 'aicw:close' }, '*');
      setIframeInteractivity(false);
      if (lazyLoadEnabled && state) createLauncher(state);
    }
    if (cmd === 'destroy') handleDestroy();
  }

  const api = win.aicw!;
  const wrapped = function (...args: QueuedCall) {
    dispatch(args);
  } as AicwApi;
  wrapped.q = api.q;
  win.aicw = wrapped;

  setupMessageBridge();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', processQueue);
  } else {
    processQueue();
  }
})();
