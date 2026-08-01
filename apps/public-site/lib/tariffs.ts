import type { TariffDto } from '@ai-consultant/shared-types';
import { siteConfig } from './site';

export async function fetchPublicTariffs(): Promise<TariffDto[]> {
  try {
    const res = await fetch(`${siteConfig.apiUrl}/public/tariffs`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return fallbackTariffs();
    return res.json();
  } catch {
    return fallbackTariffs();
  }
}

export async function fetchDemoWidget() {
  try {
    const res = await fetch(`${siteConfig.apiUrl}/public/demo-widget`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      return {
        enabled: false,
        demoWidgetKey: '',
        chatEnabled: false,
        welcomeTitle: '',
        welcomeText: '',
        apiUrl: siteConfig.apiUrl,
        widgetUrl: siteConfig.widgetUrl,
      };
    }
    return res.json() as Promise<{
      enabled: boolean;
      demoWidgetKey: string;
      chatEnabled: boolean;
      welcomeTitle: string;
      welcomeText: string;
      apiUrl: string;
      widgetUrl: string;
    }>;
  } catch {
    return {
      enabled: false,
      demoWidgetKey: '',
      chatEnabled: false,
      welcomeTitle: '',
      welcomeText: '',
      apiUrl: siteConfig.apiUrl,
      widgetUrl: siteConfig.widgetUrl,
    };
  }
}

function fallbackTariffs(): TariffDto[] {
  return [
    {
      id: 'start',
      name: 'Start',
      price: 2990,
      period: 'month',
      currency: 'RUB',
      messageLimit: 1000,
      sourceLimit: 1,
      kbLimitMb: 50,
      overagePolicy: 'block',
      features: {},
      isActive: true,
    },
    {
      id: 'pro',
      name: 'Pro',
      price: 7990,
      period: 'month',
      currency: 'RUB',
      messageLimit: 5000,
      sourceLimit: 5,
      kbLimitMb: 200,
      overagePolicy: 'block',
      features: {},
      isActive: true,
    },
    {
      id: 'business',
      name: 'Business',
      price: 19990,
      period: 'month',
      currency: 'RUB',
      messageLimit: 20000,
      sourceLimit: 20,
      kbLimitMb: 1000,
      overagePolicy: 'allow',
      features: {},
      isActive: true,
    },
  ];
}
