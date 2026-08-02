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
    default: siteConfig.name,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
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
        <main className="min-h-[70vh]">{children}</main>
        <SiteFooter />
        <SiteChatWidgetHost initial={demo} />
      </body>
    </html>
  );
}
