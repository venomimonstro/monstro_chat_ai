export const siteConfig = {
  name: 'Monstro Chat AI',
  description:
    'AI-консультант для сайта: отвечает по материалам компании, уточняет запрос и передаёт контакт менеджеру.',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:4321',
  clientAppUrl: process.env.NEXT_PUBLIC_CLIENT_URL ?? 'http://localhost:5173',
  widgetUrl: process.env.NEXT_PUBLIC_WIDGET_URL ?? 'http://localhost:5175',
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? '/api',
};
