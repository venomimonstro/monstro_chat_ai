export type PageActivation = {
  mode?: 'all' | 'include' | 'exclude';
  patterns?: string[];
};

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
  activation?: PageActivation | null,
): boolean {
  const mode = activation?.mode ?? 'all';
  const patterns = activation?.patterns?.filter(Boolean) ?? [];
  if (mode === 'all') return true;
  if (patterns.length === 0) return mode !== 'exclude';

  const matched = patterns.some((pattern) =>
    pathMatchesWidgetPattern(pathname, pattern),
  );
  if (mode === 'include') return matched;
  if (mode === 'exclude') return !matched;
  return true;
}
