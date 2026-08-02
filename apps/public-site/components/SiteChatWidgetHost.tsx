'use client';

import { useEffect, useState } from 'react';
import { SiteChatWidget } from './SiteChatWidget';
import { getBrowserApiBase } from '@/lib/api-url';

interface DemoWidgetConfig {
  enabled: boolean;
  demoWidgetKey: string;
  chatEnabled: boolean;
  welcomeTitle: string;
  welcomeText: string;
  apiUrl: string;
  widgetUrl: string;
}

interface SiteChatWidgetHostProps {
  initial?: DemoWidgetConfig | null;
}

export function SiteChatWidgetHost({ initial }: SiteChatWidgetHostProps) {
  const [demo, setDemo] = useState<DemoWidgetConfig | null>(
    initial?.chatEnabled && initial.demoWidgetKey
      ? { ...initial, apiUrl: getBrowserApiBase(initial.apiUrl) }
      : null,
  );
  const [loading, setLoading] = useState(!demo);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch('/api/public/demo-widget', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as DemoWidgetConfig;
        if (cancelled) return;

        if (data.chatEnabled && data.demoWidgetKey) {
          setDemo({
            ...data,
            apiUrl: getBrowserApiBase(data.apiUrl),
          });
        } else {
          setDemo(null);
        }
      } catch {
        /* optional */
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || !demo?.demoWidgetKey) return null;

  return (
    <SiteChatWidget
      widgetKey={demo.demoWidgetKey}
      apiUrl={demo.apiUrl}
      widgetUrl={demo.widgetUrl}
    />
  );
}
