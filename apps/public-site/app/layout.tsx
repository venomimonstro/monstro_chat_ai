import type { Metadata } from 'next';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteChatWidgetHost } from '@/components/SiteChatWidgetHost';
import { SiteInjectedScripts } from '@/components/SiteInjectedScripts';
import { JsonLd } from '@/components/JsonLd';
import { siteConfig } from '@/lib/site';
import { fetchDemoWidget, fetchSiteScripts } from '@/lib/tariffs';
import './globals.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: 'RedFlow — AI-чат для сайта, который приводит клиентов 24/7',
    template: `%s · ${siteConfig.name}`,
  },
  description:
    'RedFlow отвечает посетителям по материалам компании, уточняет запрос и передаёт контакт менеджеру вместе с историей диалога.',
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    siteName: siteConfig.name,
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const demo = await fetchDemoWidget();
  const scripts = await fetchSiteScripts();

  return (
    <html lang="ru">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <a
          href="#main-content"
          className="fixed left-4 top-3 z-[100] -translate-y-20 rounded-lg bg-white px-4 py-2 font-medium text-ink-900 shadow-lg transition focus:translate-y-0"
        >
          Перейти к содержанию
        </a>
        <SiteInjectedScripts
          customHeadHtml={scripts.customHeadHtml}
          customBodyStartHtml={scripts.customBodyStartHtml}
          customBodyEndHtml={scripts.customBodyEndHtml}
        />
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: siteConfig.name,
            url: siteConfig.url,
            description: siteConfig.description,
          }}
        />
        <SiteHeader />
        <main id="main-content" className="min-h-[70vh]">{children}</main>
        <SiteFooter />
        <SiteChatWidgetHost initial={demo} />
      </body>
    </html>
  );
}
