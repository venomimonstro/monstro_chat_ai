/** Анимация кнопки чата на сайте (Sprint 69). */
export type LauncherAnimation = 'none' | 'gentle' | 'pulse' | 'active';

/** На каких страницах показывать виджет. */
export type WidgetPageActivationMode = 'all' | 'include' | 'exclude';

export interface WidgetPageActivationConfig {
  /** all — везде; include — только matching patterns; exclude — везде кроме. */
  mode?: WidgetPageActivationMode;
  /** Паттерны пути: /pricing, /blog/*, /products/* */
  patterns?: string[];
}

export function pathMatchesWidgetPattern(pathname: string, pattern: string): boolean {
  const path = (pathname || '/').split('?')[0].toLowerCase();
  const p = pattern.trim().toLowerCase();
  if (!p) return false;
  if (p.includes('*')) {
    const re = new RegExp(
      '^' +
        p
          .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
          .replace(/\*/g, '.*') +
        '$',
    );
    return re.test(path);
  }
  return path === p || path.startsWith(p.endsWith('/') ? p : `${p}/`);
}

export function isWidgetActiveOnPage(
  pathname: string,
  activation?: WidgetPageActivationConfig | null,
): boolean {
  const mode = activation?.mode ?? 'all';
  const patterns = activation?.patterns?.filter(Boolean) ?? [];
  if (mode === 'all' || patterns.length === 0) {
    return mode !== 'exclude' || patterns.length === 0;
  }

  const matched = patterns.some((pattern) =>
    pathMatchesWidgetPattern(pathname, pattern),
  );

  if (mode === 'include') return matched;
  if (mode === 'exclude') return !matched;
  return true;
}

export const LAUNCHER_ANIMATION_LABELS: Record<LauncherAnimation, string> = {
  none: 'Без анимации',
  gentle: 'Лёгкая (пульс)',
  pulse: 'Заметная (кольцо)',
  active: 'Активная (прыжок + кольцо)',
};
