'use client';

import { useEffect } from 'react';
import { injectCustomHtml } from '@/lib/inject-html';

export interface SiteScriptsPayload {
  customHeadHtml: string;
  customBodyStartHtml: string;
  customBodyEndHtml: string;
}

interface SiteInjectedScriptsProps extends Partial<SiteScriptsPayload> {}

async function fetchScriptsFromApi(): Promise<SiteScriptsPayload | null> {
  try {
    const res = await fetch('/api/public/site-scripts', { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as SiteScriptsPayload;
  } catch {
    return null;
  }
}

function hasAnyScript(payload: Partial<SiteScriptsPayload>): boolean {
  return Boolean(
    payload.customHeadHtml?.trim() ||
      payload.customBodyStartHtml?.trim() ||
      payload.customBodyEndHtml?.trim(),
  );
}

export function SiteInjectedScripts({
  customHeadHtml = '',
  customBodyStartHtml = '',
  customBodyEndHtml = '',
}: SiteInjectedScriptsProps) {
  useEffect(() => {
    let cancelled = false;

    async function apply() {
      let head = customHeadHtml;
      let bodyStart = customBodyStartHtml;
      let bodyEnd = customBodyEndHtml;

      if (!hasAnyScript({ customHeadHtml: head, customBodyStartHtml: bodyStart, customBodyEndHtml: bodyEnd })) {
        const remote = await fetchScriptsFromApi();
        if (remote) {
          head = remote.customHeadHtml ?? '';
          bodyStart = remote.customBodyStartHtml ?? '';
          bodyEnd = remote.customBodyEndHtml ?? '';
        }
      }

      if (cancelled) return;

      injectCustomHtml(document.head, head, 'aicw-custom-head', 'append');
      injectCustomHtml(document.body, bodyStart, 'aicw-custom-body-start', 'prepend');
      injectCustomHtml(document.body, bodyEnd, 'aicw-custom-body-end', 'append');
    }

    void apply();
    return () => {
      cancelled = true;
    };
  }, [customHeadHtml, customBodyStartHtml, customBodyEndHtml]);

  return null;
}
