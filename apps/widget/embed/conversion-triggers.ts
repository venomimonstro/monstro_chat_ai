export type ConversionTriggerReason = 'delay' | 'scroll' | 'exit';

export interface ConversionTriggerBehavior {
  autoOpenDelaySeconds?: number;
  autoOpenOnScrollPercent?: number;
  exitIntent?: boolean;
}

export interface ConversionTriggerOptions {
  hideOnMobile?: boolean;
  isMobile?: () => boolean;
  storageKey: string;
  readStorage?: (key: string) => string | null;
  writeStorage?: (key: string, value: string) => void;
}

export function getScrollDepthPercent(
  scrollY: number,
  scrollHeight: number,
  clientHeight: number,
): number {
  const maxScroll = Math.max(scrollHeight - clientHeight, 1);
  return Math.min(100, Math.round((scrollY / maxScroll) * 100));
}

export function isExitIntentEvent(clientY: number, relatedTarget: EventTarget | null): boolean {
  return clientY <= 0 && relatedTarget == null;
}

export function shouldArmTriggers(
  behavior: ConversionTriggerBehavior,
  opts: ConversionTriggerOptions,
): boolean {
  const read = opts.readStorage ?? ((key: string) => {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  });

  if (read(opts.storageKey)) return false;

  const isMobile = opts.isMobile?.() ?? false;
  if (opts.hideOnMobile && isMobile) return false;

  const delay = behavior.autoOpenDelaySeconds ?? 0;
  const scroll = behavior.autoOpenOnScrollPercent ?? 0;
  const exit = behavior.exitIntent === true;

  return delay > 0 || scroll > 0 || exit;
}

export function armConversionTriggers(
  behavior: ConversionTriggerBehavior,
  opts: ConversionTriggerOptions,
  onFire: (reason: ConversionTriggerReason) => void,
): () => void {
  if (!shouldArmTriggers(behavior, opts)) {
    return () => undefined;
  }

  const read = opts.readStorage ?? ((key: string) => {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  });
  const write = opts.writeStorage ?? ((key: string, value: string) => {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      /* private mode */
    }
  });

  let fired = false;
  const cleanups: Array<() => void> = [];

  const fireOnce = (reason: ConversionTriggerReason) => {
    if (fired || read(opts.storageKey)) return;
    fired = true;
    write(opts.storageKey, reason);
    for (const cleanup of cleanups) cleanup();
    cleanups.length = 0;
    onFire(reason);
  };

  const delaySec = behavior.autoOpenDelaySeconds ?? 0;
  if (delaySec > 0) {
    const timer = setTimeout(() => fireOnce('delay'), delaySec * 1000);
    cleanups.push(() => clearTimeout(timer));
  }

  const scrollPct = behavior.autoOpenOnScrollPercent ?? 0;
  if (scrollPct > 0 && typeof window !== 'undefined') {
    const onScroll = () => {
      const depth = getScrollDepthPercent(
        window.scrollY,
        document.documentElement.scrollHeight,
        window.innerHeight,
      );
      if (depth >= scrollPct) fireOnce('scroll');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    cleanups.push(() => window.removeEventListener('scroll', onScroll));
    onScroll();
  }

  if (behavior.exitIntent === true && typeof document !== 'undefined') {
    const onMouseOut = (event: MouseEvent) => {
      if (isExitIntentEvent(event.clientY, event.relatedTarget)) {
        fireOnce('exit');
      }
    };
    document.documentElement.addEventListener('mouseout', onMouseOut);
    cleanups.push(() =>
      document.documentElement.removeEventListener('mouseout', onMouseOut),
    );
  }

  return () => {
    for (const cleanup of cleanups) cleanup();
    cleanups.length = 0;
  };
}

export function markTriggerEngaged(
  storageKey: string,
  writeStorage?: (key: string, value: string) => void,
) {
  const write = writeStorage ?? ((key: string, value: string) => {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  });
  write(storageKey, 'manual');
}
