import type { Metadata } from 'next';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteChatWidget } from '@/components/SiteChatWidget';
import { JsonLd } from '@/components/JsonLd';
import { siteConfig } from '@/lib/site';
import { fetchDemoWidget } from '@/lib/tariffs';
import './globals.css';

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

  return (
    <html lang="ru">
      <body>
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
        {demo.enabled && demo.demoWidgetKey && (
          <SiteChatWidget
            widgetKey={demo.demoWidgetKey}
            apiUrl={demo.apiUrl}
            widgetUrl={demo.widgetUrl}
          />
        )}
      </body>
    </html>
  );
}
