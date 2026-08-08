/**
 * Resolve API base URL for server-side fetches in Next.js (SSR).
 */
export function getServerApiBase(): string {
  const internal = process.env.API_INTERNAL_URL?.replace(/\/$/, '');
  if (internal) return `${internal}/api`;

  const publicUrl = process.env.NEXT_PUBLIC_API_URL;
  if (publicUrl?.startsWith('http')) return publicUrl.replace(/\/$/, '');

  return 'http://127.0.0.1:3000/api';
}

/**
 * Resolve API URL for the widget in the browser.
 */
export function getBrowserApiBase(fallback?: string): string {
  if (fallback?.startsWith('http')) return fallback.replace(/\/$/, '');

  const publicUrl = process.env.NEXT_PUBLIC_API_URL;
  if (publicUrl?.startsWith('http')) return publicUrl.replace(/\/$/, '');

  if (typeof window !== 'undefined') {
    if (publicUrl?.startsWith('/')) return publicUrl.replace(/\/$/, '');
    return `${window.location.origin}/api`;
  }

  return (fallback ?? '/api').replace(/\/$/, '');
}
