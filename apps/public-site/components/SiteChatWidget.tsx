'use client';

import { useEffect, useRef } from 'react';
import { siteConfig } from '@/lib/site';
import { getBrowserApiBase } from '@/lib/api-url';

interface SiteChatWidgetProps {
  widgetKey: string;
  apiUrl?: string;
  widgetUrl?: string;
}

export function SiteChatWidget({
  widgetKey,
  apiUrl,
  widgetUrl,
}: SiteChatWidgetProps) {
  const mounted = useRef(false);

  useEffect(() => {
    if (!widgetKey || mounted.current) return;
    mounted.current = true;

    const scriptSrc = `${(widgetUrl ?? siteConfig.widgetUrl).replace(/\/$/, '')}/embed.js`;
    const resolvedApiUrl = getBrowserApiBase(apiUrl);
    const resolvedWidgetUrl = (widgetUrl ?? siteConfig.widgetUrl).replace(/\/$/, '');

    const win = window as Window & {
      aicw?: ((...args: unknown[]) => void) & { q?: unknown[][] };
    };
    if (!win.aicw) {
      const stub = function (...args: unknown[]) {
        stub.q = stub.q || [];
        stub.q.push(args);
      } as ((...args: unknown[]) => void) & { q?: unknown[][] };
      win.aicw = stub;
    }

    const script = document.createElement('script');
    script.id = 'aicw-site-embed';
    script.src = scriptSrc;
    script.async = true;
    script.onload = () => {
      win.aicw?.('init', {
        widgetKey,
        apiUrl: resolvedApiUrl,
        widgetUrl: resolvedWidgetUrl,
        lazyLoad: true,
      });
    };
    script.onerror = () => {
      console.error('[AI-Consultant] Failed to load widget embed.js from', scriptSrc);
    };
    document.body.appendChild(script);

    return () => {
      win.aicw?.('destroy');
      document.getElementById('aicw-site-embed')?.remove();
      mounted.current = false;
    };
  }, [widgetKey, apiUrl, widgetUrl]);

  return null;
}
