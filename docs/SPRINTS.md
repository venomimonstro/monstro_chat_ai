# Sprint tracking

| Sprint | Статус | DoD |
|--------|--------|-----|
| 0 | Done | Инфраструктура, CI, health, миграции v1, UI login/register |
| 1 | Done | Auth, JWT, RBAC, 2FA, trial, rate limit |
| 2 | Done | Sources CRUD, embed.js, widget, WS gateway |
| 3 | Done | Crawling, knowledge base, embeddings, training tab |
| 4 | Done | AI Orchestrator, RAG, streaming, providers |
| 5 | Done | Leads extraction, prompts, playground, anti-injection |
| 6 | Done | CRM kanban, pipelines, lead merge/assign, WS/email |
| 7 | Done | Billing, tariffs, limits, trial expiry |
| 8 | Done | YooKassa checkout, webhooks, renewals, receipts |
| 9 | Done | Semantic cache, model routing, margin dashboard |
| 10 | Done | Metrika, GTM, UTM, offline conversions |
| 11 | Done | amoCRM, Bitrix24 export, field mapping, retry queue |
| 12 | Done | Two-way status sync, status mapping, webhooks, loop lock |
| 13 | Done | Admin tenants, impersonation, audit log, hash chain |
| 14 | Done | System updates, blue-green, backups, canary rollback |
| 15 | Done | Report builder, dashboards, tenant statistics, CSV export, cache |
| 16 | Done | Public site, SEO, legal, PD consent, QA tooling |
| 17 | Done | Целостность: полный аудит, регрессия, исправление багов |
| 18 | Done | Стабильность: перф, edge cases, e2e, production hardening |
| 19 | Done | Публичный сайт в стиле Jivo.ru — дизайн-система, лендинг |
| 20 | Done | Виджет/чат: UX для посетителей, мобильная версия |
| 21 | Done | ЛК клиента: полировка UI, пустые состояния, CRM |
| 22 | Done | Админка + аналитика: читаемость, таблицы, формы |
| 23 | Done | Адаптив, микро-UX, онбординг, единый тон ошибок |
| 24 | Done | Post-audit: cookie auth, CSRF, migrate init-job, admin read-only UI |
| 25 | Done | Доставка лидов: Telegram, email, Google Sheets, Bitrix24, amoCRM |
| 26 | Done | Чат v2: UX на ПК/планшете/мобиле, reconnect, emoji, FAQ sidebar |
| 27 | Done | Производительность виджета: lazy embed ≤8KB, defer WS, CDN cache |
| 28 | Done | ЛК клиента v2: дизайн-система, insights, CRM bulk, статистика drill-down, настройки |
| 29 | Done | Админка v2: тарифы CRUD, LLM-провайдеры, bulk suspend, system health |
| 30 | Done | MVP-essentials: forgot password, team invites, notifications, GDPR export, webhooks, clone source |
| 31 | Done | Каналы VK/Telegram, A/B промптов, PWA менеджеров |
| 32 | Done | Ключи LLM в админке, чат на публичном сайте, настройки виджета |
| 33 | Done | Release pipeline: версии, verify, деплой, откат, спринты в админке |
| 34 | Done | Ключи LLM + тест, ЛК платформы для админа, виджет в углу, починка вкладок ЛК |

Подробности — в `AI-Consultant-Platform-MASTER.md`, раздел «Спринт-план».

## Фазы после MVP

### Фаза 1 — Стабилизация (Sprint 17–18)

Без новых фич. Цель: пройти весь проект, устранить баги, нестыковки API/UI/типов, довести до production-ready.

### Фаза 2 — UI/UX-полировка (Sprint 19–23)

Без сложных новых модулей. Цель: публичный сайт в духе [Jivo.ru](https://www.jivo.ru/), удобный чат, единообразный интерфейс ЛК и админки.

### Фаза 3 — Post-audit и доставка лидов (Sprint 24–25)

Закрытие хвостов аудита + ключевая бизнес-ценность: клиент получает лиды туда, куда ему удобно (Telegram, email, Sheets, CRM).

### Фаза 4 — Чат и производительность (Sprint 26–27)

Максимальное удобство чата на всех устройствах + супер-лёгкий виджет, который не тормозит сайт клиента.

### Фаза 5 — Продуктовая зрелость (Sprint 28–30)

Глубокая полировка ЛК и админки + must-have функции для реального запуска MVP.

### Фаза 6 — Расширение каналов (Sprint 31)

VK/Telegram как входящие каналы, A/B промптов, PWA для менеджеров.

### Фаза 7 — Release pipeline (Sprint 33)

Версионированные релизы с pre/post проверками, откатом через админку и CLI, учёт спринтов.
