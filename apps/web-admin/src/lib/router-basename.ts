/** Vite `base` (/admin/ in production) — React Router needs the same prefix. */
export function getRouterBasename(): string | undefined {
  const normalized = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
  return normalized || undefined;
}
