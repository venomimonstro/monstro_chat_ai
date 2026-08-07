import {
  armConversionTriggers,
  markTriggerEngaged,
  type ConversionTriggerBehavior,
} from './conversion-triggers';
import { injectLauncherStyles, type EmbedAppearance } from './launcher-styles';
import { isWidgetActiveOnPage } from './page-rules';

type WidgetConfig = {
  appearance?: EmbedAppearance;
  behavior?: ConversionTriggerBehavior & {
    defaultOpen?: boolean;
    showLauncherDelaySeconds?: number;
    pageActivation?: { mode?: 'all' | 'include' | 'exclude'; patterns?: string[] };
  };
};

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
  let launcherWrap: HTMLDivElement | null = null;
  let launcherBtn: HTMLButtonElement | null = null;
  let launcherShowTimer: ReturnType<typeof setTimeout> | null = null;
  let cachedConfig: WidgetConfig | null = null;
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
    if (launcherShowTimer) {
      clearTimeout(launcherShowTimer);
      launcherShowTimer = null;
    }
    launcherWrap?.remove();
    launcherWrap = null;
    launcherBtn = null;
  }

  function isMobileViewport(): boolean {
    return window.matchMedia('(max-width: 768px)').matches;
  }

  function shouldShowWidget(config: WidgetConfig | null): boolean {
    if (!config) return true;
    if (!isWidgetActiveOnPage(location.pathname, config.behavior?.pageActivation)) {
      return false;
    }
    if (config.appearance?.hideOnMobile && isMobileViewport()) {
      return false;
    }
    return true;
  }

  function resolveAppearance(
    opts: InitOptions,
    config: WidgetConfig | null,
  ): Required<
    Pick<
      EmbedAppearance,
      | 'primaryColor'
      | 'textColor'
      | 'buttonShape'
      | 'position'
      | 'offsetX'
      | 'offsetY'
      | 'launcherAnimation'
      | 'showLauncherLabel'
      | 'launcherOnlineIndicator'
    >
  > & { launcherLabel: string } {
    const a = config?.appearance ?? {};
    return {
      primaryColor: a.primaryColor ?? opts.primaryColor ?? '#EF2B34',
      textColor: a.textColor ?? '#ffffff',
      buttonShape: a.buttonShape ?? 'round',
      position: a.position ?? opts.position ?? 'bottom-right',
      offsetX: a.offsetX ?? 20,
      offsetY: a.offsetY ?? 20,
      launcherAnimation: a.launcherAnimation ?? 'gentle',
      launcherLabel: a.launcherLabel ?? 'Оператор онлайн',
      showLauncherLabel: a.showLauncherLabel === true,
      launcherOnlineIndicator: a.launcherOnlineIndicator !== false,
    };
  }

  function applyLauncherAppearance(
    appearance: ReturnType<typeof resolveAppearance>,
  ) {
    if (!launcherWrap || !launcherBtn) return;
    const isLeft = appearance.position === 'bottom-left';
    launcherWrap.className = `aicw-visible ${isLeft ? 'aicw-left' : ''}`.trim();
    Object.assign(launcherWrap.style, {
      bottom: `${appearance.offsetY}px`,
      left: isLeft ? `${appearance.offsetX}px` : 'auto',
      right: isLeft ? 'auto' : `${appearance.offsetX}px`,
    });

    const size = '48px';
    const radius = appearance.buttonShape === 'square' ? '12px' : '50%';
    Object.assign(launcherBtn.style, {
      width: size,
      height: size,
      borderRadius: radius,
      background: appearance.primaryColor,
      color: appearance.textColor,
    });

    launcherBtn.className = '';
    if (appearance.launcherAnimation === 'gentle') {
      launcherBtn.classList.add('aicw-anim-gentle');
    } else if (appearance.launcherAnimation === 'pulse') {
      launcherBtn.classList.add('aicw-anim-pulse');
    } else if (appearance.launcherAnimation === 'active') {
      launcherBtn.classList.add('aicw-anim-active');
    }

    const labelEl = launcherWrap.querySelector('#aicw-launcher-label') as
      | HTMLSpanElement
      | null;
    if (labelEl) {
      labelEl.textContent = appearance.launcherLabel;
      labelEl.style.display = appearance.showLauncherLabel ? 'block' : 'none';
    }

    let onlineEl = launcherBtn.querySelector(
      '#aicw-launcher-online',
    ) as HTMLSpanElement | null;
    if (appearance.launcherOnlineIndicator) {
      if (!onlineEl) {
        onlineEl = document.createElement('span');
        onlineEl.id = 'aicw-launcher-online';
        launcherBtn.appendChild(onlineEl);
      }
    } else {
      onlineEl?.remove();
    }

    const label = appearance.showLauncherLabel
      ? appearance.launcherLabel
      : 'Открыть чат';
    launcherBtn.setAttribute('aria-label', label);
  }

  function createLauncher(opts: InitOptions, config: WidgetConfig | null) {
    if (launcherWrap || !shouldShowWidget(config)) return;
    injectLauncherStyles();

    const appearance = resolveAppearance(opts, config);
    const isLeft = appearance.position === 'bottom-left';

    launcherWrap = document.createElement('div');
    launcherWrap.id = 'aicw-launcher-wrap';

    if (appearance.showLauncherLabel) {
      const labelEl = document.createElement('span');
      labelEl.id = 'aicw-launcher-label';
      labelEl.textContent = appearance.launcherLabel;
      launcherWrap.appendChild(labelEl);
    }

    launcherBtn = document.createElement('button');
    launcherBtn.type = 'button';
    launcherBtn.setAttribute('aria-expanded', 'false');
    launcherBtn.id = 'aicw-launcher';
    launcherBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>';

    launcherBtn.addEventListener('mouseenter', () => preconnectOrigins(opts), {
      once: true,
    });
    launcherBtn.addEventListener('focus', () => preconnectOrigins(opts), {
      once: true,
    });
    launcherBtn.addEventListener('click', () =>
      activateWidget(opts, true, { manual: true }),
    );

    launcherWrap.appendChild(launcherBtn);
    document.body.appendChild(launcherWrap);
    applyLauncherAppearance(appearance);

    requestAnimationFrame(() => {
      launcherWrap?.classList.add('aicw-visible');
    });
  }

  function scheduleLauncher(opts: InitOptions, config: WidgetConfig | null) {
    if (!shouldShowWidget(config)) return;
    const delaySec = config?.behavior?.showLauncherDelaySeconds ?? 0;
    if (delaySec > 0) {
      launcherShowTimer = setTimeout(
        () => createLauncher(opts, config),
        delaySec * 1000,
      );
    } else {
      createLauncher(opts, config);
    }
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
          scheduleLauncher(state, cachedConfig);
        }
      }
    });
  }

  function finalizeOpen() {
    removeLauncher();
    window.dispatchEvent(new Event('aicw:opened'));
  }

  function postParentOriginToIframe() {
    if (!iframe?.contentWindow) return;
    const targetOrigin = iframe.src ? new URL(iframe.src).origin : '*';
    iframe.contentWindow.postMessage(
      { type: 'aicw:parent-origin', parentOrigin: window.location.origin },
      targetOrigin,
    );
  }

  function loadIframe(opts: InitOptions, autoOpen = false) {
    if (iframe) {
      postParentOriginToIframe();
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
    if (!autoOpen) {
      iframe.setAttribute('loading', 'lazy');
    }
    document.body.appendChild(iframe);

    let openFallbackTimer: ReturnType<typeof setTimeout> | null = null;

    iframe.onload = () => {
      if (!iframe?.contentWindow) return;
      postParentOriginToIframe();
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

  function updateLauncherFromConfig(config: WidgetConfig) {
    cachedConfig = config;
    if (!shouldShowWidget(config)) {
      removeLauncher();
      return;
    }
    if (!launcherWrap && state && lazyLoadEnabled) {
      scheduleLauncher(state, config);
      return;
    }
    if (launcherWrap && launcherBtn && state) {
      applyLauncherAppearance(resolveAppearance(state, config));
    }
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

  function setupConversionTriggers(opts: InitOptions, config?: WidgetConfig | null) {
    if (triggerCleanup) {
      triggerCleanup();
      triggerCleanup = null;
    }

    const applyTriggers = (cfg: WidgetConfig) => {
      if (state?.widgetKey !== opts.widgetKey || !shouldShowWidget(cfg)) return;

      updateLauncherFromConfig(cfg);

      const behavior = (cfg.behavior ?? {}) as ConversionTriggerBehavior;
      const hideOnMobile = cfg.appearance?.hideOnMobile === true;

      triggerCleanup = armConversionTriggers(
        behavior,
        {
          storageKey: triggerStorageKey(opts.widgetKey),
          hideOnMobile,
          isMobile: isMobileViewport,
        },
        () => activateWidget(opts, true),
      );
    };

    if (config) {
      applyTriggers(config);
      return;
    }

    const apiUrl = getApiUrl(opts);
    fetch(`${apiUrl}/widget/config/${encodeURIComponent(opts.widgetKey)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data?.config) return;
        applyTriggers(data.config as WidgetConfig);
      })
      .catch(() => undefined);
  }

  function fetchConfigAndInit(opts: InitOptions) {
    const apiUrl = getApiUrl(opts);
    fetch(`${apiUrl}/widget/config/${encodeURIComponent(opts.widgetKey)}`)
      .then((r) => r.json())
      .then((data) => {
        const config = (data?.config ?? {}) as WidgetConfig;
        cachedConfig = config;
        applyInitWithConfig(opts, config);
      })
      .catch(() => {
        applyInitWithConfig(opts, null);
      });
  }

  function applyInitWithConfig(opts: InitOptions, config: WidgetConfig | null) {
    if (!shouldShowWidget(config)) {
      return;
    }

    if (lazyLoadEnabled) {
      if (config?.behavior?.defaultOpen) {
        activateWidget(opts, true);
        setupConversionTriggers(opts, config);
        return;
      }
      scheduleLauncher(opts, config);
      setupConversionTriggers(opts, config);
      return;
    }

    startNetworkActivity(opts);
    registerInteractionFallback(opts);
    scheduleLoad(opts);
    if (config?.behavior?.defaultOpen) {
      activateWidget(opts, true);
    }
    setupConversionTriggers(opts, config);
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
    injectLauncherStyles();
    fetchConfigAndInit(opts);
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
    cachedConfig = null;
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
      if (lazyLoadEnabled && state) scheduleLauncher(state, cachedConfig);
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
