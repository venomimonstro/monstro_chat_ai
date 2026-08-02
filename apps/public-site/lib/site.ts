export const siteConfig = {
  name: 'AI-Консультант',
  description:
    'AI-продавец для сайта: отвечает 24/7, собирает лиды в CRM. Платите за сообщения — не за каждый лид.',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:4321',
  clientAppUrl: process.env.NEXT_PUBLIC_CLIENT_URL ?? 'http://localhost:5173',
  widgetUrl: process.env.NEXT_PUBLIC_WIDGET_URL ?? 'http://localhost:5175',
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? '/api',
};
