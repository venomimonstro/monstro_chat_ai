'use client';

import Script from 'next/script';
import { siteConfig } from '@/lib/site';

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
  if (!widgetKey) return null;

  const scriptSrc = `${widgetUrl ?? siteConfig.widgetUrl}/embed.js`;
  const resolvedApiUrl = apiUrl ?? siteConfig.apiUrl;

  return (
    <>
      <Script id="aicw-site" strategy="afterInteractive">
        {`window.aicw=window.aicw||function(){(window.aicw.q=window.aicw.q||[]).push(arguments)};`}
      </Script>
      <Script
        id="aicw-site-embed"
        src={scriptSrc}
        strategy="afterInteractive"
        onLoad={() => {
          const api = (window as Window & { aicw?: (...args: unknown[]) => void }).aicw;
          api?.('init', { widgetKey, apiUrl: resolvedApiUrl });
        }}
      />
    </>
  );
}
