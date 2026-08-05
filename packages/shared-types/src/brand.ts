/** Брендинг продукта (Sprint 70 — RedFlow). */
export const BRAND = {
  name: 'RedFlow',
  legalName: 'RedFlow',
  tagline: 'AI-консультант для сайта',
  domain: 'redflow.ru',
  wwwDomain: 'www.redflow.ru',
  /** Предпочтительный путь установки на VPS */
  installDir: '/opt/redflow',
  /** Legacy path (до переименования) */
  legacyInstallDir: '/opt/monstro_chat_ai',
  repoUrl: 'https://github.com/venomimonstro/monstro_chat_ai.git',
} as const;

export function productionUrls(domain = BRAND.domain) {
  const base = `https://${domain}`;
  return {
    site: base,
    api: `${base}/api`,
    client: `${base}/app`,
    admin: `${base}/admin`,
    widget: `${base}/widget`,
  };
}
