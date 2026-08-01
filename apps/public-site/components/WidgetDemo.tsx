import Script from 'next/script';
import { siteConfig } from '@/lib/site';

interface WidgetDemoProps {
  widgetKey: string;
  apiUrl?: string;
  widgetUrl?: string;
  welcomeTitle?: string;
  welcomeText?: string;
  showEmbed?: boolean;
}

export function WidgetDemo({
  widgetKey,
  apiUrl,
  widgetUrl,
  welcomeTitle = 'Живое демо',
  welcomeText = 'Нажмите на кнопку чата в правом нижнем углу и задайте вопрос как посетитель вашего сайта.',
  showEmbed = true,
}: WidgetDemoProps) {
  if (!widgetKey) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
        Демо-виджет будет доступен после настройки ключа в админке
        (раздел «Сайт / чат»)
      </div>
    );
  }

  const scriptSrc = `${widgetUrl ?? siteConfig.widgetUrl}/embed.js`;
  const resolvedApiUrl = apiUrl ?? siteConfig.apiUrl;

  return (
    <>
      {showEmbed && (
        <>
          <Script id="aicw-demo" strategy="afterInteractive">
            {`window.aicw=window.aicw||function(){(window.aicw.q=window.aicw.q||[]).push(arguments)};`}
          </Script>
          <Script
            id="aicw-embed"
            src={scriptSrc}
            strategy="afterInteractive"
            onLoad={() => {
              const api = (window as Window & { aicw?: (...args: unknown[]) => void }).aicw;
              api?.('init', { widgetKey, apiUrl: resolvedApiUrl });
            }}
          />
        </>
      )}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-brand-50 to-white p-8">
        <p className="text-sm font-medium text-brand-700">{welcomeTitle}</p>
        <h3 className="mt-2 text-2xl font-bold text-slate-900">
          Попробуйте виджет прямо на этой странице
        </h3>
        <p className="mt-2 text-slate-600">{welcomeText}</p>
      </div>
    </>
  );
}
