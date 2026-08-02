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
    initial?.enabled && initial.demoWidgetKey ? initial : null,
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch('/api/public/demo-widget', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as DemoWidgetConfig;
        if (!cancelled && data.enabled && data.demoWidgetKey) {
          setDemo({
            ...data,
            apiUrl: getBrowserApiBase(data.apiUrl),
          });
        }
      } catch {
        /* widget optional */
      }
    }

    if (!demo) {
      void load();
    }

    return () => {
      cancelled = true;
    };
  }, [demo]);

  if (!demo?.demoWidgetKey) return null;

  return (
    <SiteChatWidget
      widgetKey={demo.demoWidgetKey}
      apiUrl={getBrowserApiBase(demo.apiUrl)}
      widgetUrl={demo.widgetUrl}
    />
  );
}
