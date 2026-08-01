# Известные ограничения и план их устранения

## Закрытые в ходе глубокого аудита (post Sprint 23)

- **CORS**: `main.ts` теперь отклоняет неизвестные origin вместо рефлекса.
- **RLS**: `TenantContextMiddleware` сбрасывает `app.current_tenant_id` в `finally`, предотвращая утечку контекста между запросами в пуле соединений. `PrismaService.setTenantContext` использует параметризованный `set_config`.
- **YooKassa webhook**: добавлена опциональная HMAC-проверка подписи (`x-signature`). Активация платежа теперь атомарна через `updateMany ... WHERE status='pending'`.
- **web-admin auth**: реализована полноценная авторизация (login, 2FA, refresh, защищённые маршруты, выход).
- **Impersonation**: токен больше не передаётся в URL. Используется одноразовый exchange code + Redis + POST `/admin/impersonation/exchange`.
- **Widget origin validation**: WebSocket и postMessage проверяют разрешённые origin из `SourceConfig.security.allowedOrigins`; embed использует `targetOrigin` iframe.
- **Vector indexes**: добавлен HNSW-индекс для `semantic_cache_entries`; дополнительные B-tree индексы для аналитики.
- **Usage limit**: пересчёт овердрафта вынесен за пределы `recordMessage` для атомарности инкремента.
- **2FA**: секреты шифруются AES-256-GCM перед сохранением в БД (`TWO_FA_SECRET_KEY`).
- **Refresh tokens**: в refresh token хранится флаг `twoFaVerified` и `sessionVersion`; при сбросе пароля/2FA инкрементируется `sessionVersion`, что отзывает все активные сессии.
- **Admin password reset**: временный пароль больше не возвращается в ответе; владелец должен использовать самостоятельный сброс через email.
- **JWT TTL**: `JWT_ACCESS_TTL` и `JWT_2FA_TTL` берутся из конфигурации.
- **Audit hash chain**: операции `append` сериализованы через promise chain, предотвращая гонки при параллельной записи.
- **Widget socket**: соединение не пересоздаётся при смене `dialogId`; re-join происходит внутри открытого сокета.
- **WebSocket revalidation**: CRM, Indexing и Updates gateways каждые 60 секунд проверяют, что пользователь всё ещё активен и принадлежит тому же tenant/роли.
- **Helmet**: к API добавлены security-заголовки Helmet.
- **Rate limiting**: глобальный throttle 120 запросов в минуту (`@nestjs/throttler`).
- **Duplicate types**: `LeadDto` в `prompt.ts` переименован в `LeadExtractDto` для устранения конфликта с `crm.ts`.
- **Dockerfile**: API-контейнер запускается под непривилегированным пользователем `nestjs`.
- **Production secrets**: в `main.ts` проверяется наличие и безопасность критичных env.
- **Cookie auth (Sprint 24)**: access token в `httpOnly` cookie (`aicw_access` / `aicw_admin_access`), CSRF double-submit (`aicw_csrf` + `X-CSRF-Token`).
- **Migrate init-job (Sprint 24)**: `prisma migrate deploy` вынесен в отдельный docker-compose сервис `migrate`.
- **Admin read-only UI (Sprint 24)**: страницы тарифов и LLM-провайдеров вместо placeholder.
- **CRM kanban (Sprint 24)**: индикатор «Сохранение…» при drag-and-drop.
- **Lead Delivery Hub (Sprint 25)**: Telegram, email, Google Sheets, CRM-каналы; BullMQ `lead-delivery`; UI в разделе «Интеграции».

## Оставшиеся ограничения

| # | Проблема | Приоритет | План устранения | Owner |
|---|----------|-----------|-----------------|-------|
| 1 | Нет полного CRUD тарифов в админке (только read-only) | Medium | Sprint 29 | Frontend |
| 2 | Нет полного CRUD LLM-провайдеров в админке (только read-only) | Medium | Sprint 29 | Frontend |
| 3 | PWA/offline для менеджеров отложен | Low | Sprint 31 | Backend |
| 4 | VK/Telegram каналы отложены | Low | Sprint 31 | Backend |
| 5 | Виджет не оптимизирован под Core Web Vitals хост-сайта | Medium | Sprint 27 | Frontend |
| 6 | Нет must-have MVP: forgot password, team invite, webhooks | High | Sprint 30 | Backend+Frontend |
| 7 | Регистрация с public-site и вход в web-client — разные origin, cookie не шарится | Low | Sprint 30 (SSO redirect flow) | Frontend |

## Владельцы

- Frontend: команда веб-разработки
- Backend: команда API/NestJS
- DevOps: команда инфраструктуры
