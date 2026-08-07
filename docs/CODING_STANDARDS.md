# Стандарты разработки AI-Consultant Platform

Документ фиксирует правила, вытекающие из аудита проекта. Цель — стабильный, безопасный, поддерживаемый продукт "100 из 100".

## 1. Общие принципы

1. **Сначала корректность, потом скорость.** Любая оптимизация должна сохранять атомарность, обработку ошибок и типовую безопасность.
2. **Не молчать об ошибках.** В production не должно быть `catch { }` или `void` без логирования.
3. **Не доверяй входным данным.** Все внешные параметры (query, body, cookies, JSON-поля) валидируются через DTO/Zod.
4. **Tenant-изоляция обязательна.** Каждый запрос к данным должен содержать `tenantId` в `where` (или RLS-контекст). Исключение — строго административные методы с явным аудитом.
5. **Не допускай race conditions.** Read-modify-write заменяется на `increment`/`upsert`/`$transaction` с блокировкой или уникальными индексами.

## 2. TypeScript / типовая безопасность

- Запрещено использовать `any` в production-коде. Для тестовых моков — `as never`/`any` допустимо с комментарием.
- Все публичные функции и сервисные методы должны иметь возвращаемый тип.
- Все DTO в `apps/api/src/**/dto/*.ts` должны использовать `class-validator` декораторы.
- JSON-поля Prisma (`configJson`, `metadataJson`, `statsJson`) читаются/пишутся только через строго типизированные функции и runtime-валидатор (Zod / `class-validator`).

## 3. Асинхронность и race conditions

- Запрещено `Promise` без `await` в коде, за исключением явного фонового действия (audit, webhook, push) с `.catch()`.
- Фоновые задачи должны логировать ошибки и не пробрасывать rejection в процесс:
  ```ts
  void this.outgoingWebhook.deliver(...).catch((err) =>
    this.logger.warn('Webhook failed', err),
  );
  ```
- Для каждого цикла read-modify-write:
  - **Redis:** `INCR`/`DECR` или Lua-скрипт.
  - **Prisma:** `update`/`updateMany` с `increment`/`decrement`, `upsert`, или `$transaction` + `SELECT FOR UPDATE`.
  - **Сложные бизнес-операции:** `prisma.$transaction(async (tx) => { ... })`.
- Конкурентные create-действия (лиды, заявки, инвайты) должны либо иметь unique-индекс, либо обрабатывать `P2002` и retry.
- В React запросы, зависящие от состояния, должны отменяться через `AbortController` или проверять актуальность ID перед `setState`.

## 4. Безопасность

- Все мутации и админские endpoint-ы должны быть под CSRF (для cookie-based сессий) и требовать `X-AICW-App` для разделения admin/client.
- Сравнение секретов (CSRF, webhook токены, deploy токены) — через `crypto.timingSafeEqual`.
- Все публичные endpoint-ы (auth, webhooks) должны иметь `@Throttle()` или rate-limit на уровне сервиса.
- Cookie:
  - `Secure` по умолчанию в production; отключение только через явный `COOKIE_SECURE=false`.
  - `SameSite=Lax` или `Strict` для auth.
  - Refresh token — `httpOnly: true`, `path: /`.
- Запрещено возвращать access token или refresh token в JSON тела ответа (кроме одноразовых exchange-кодов).
- Любой admin-экшн записывается в audit log.

## 5. База данных и Prisma

- Каждое изменение `schema.prisma` сопровождается migration SQL (без `IF NOT EXISTS` в основных миграциях).
- Уникальные бизнес-ограничения должны быть уникальными индексами в БД, а не только проверками в приложении:
  - один активный промпт на scope/tenant;
  - одна дефолтная воронка на tenant;
  - один активный тариф на tenant;
  - уникальность `(tenantId, phone)` для неархивных лидов.
- Все `update`/`updateMany`/`deleteMany` по ID должны включать `tenantId` (или другой tenant-scoped фильтр).
- `findMany` без пагинации запрещены: обязательно `take` с разумным лимитом (максимум 1000) и `skip`/`cursor` для списков.
- Все foreign key должны иметь явный `onDelete` и соответствовать `schema.prisma`.
- RLS-политики: либо запрещаем доступ при `current_setting('app.current_tenant_id') IS NULL`, либо не используем RLS (вместо этого — строгие фильтры в коде).

## 6. Frontend (React / Vite / Socket.io)

- Для socket-соединений обязателен mutex (`connectingRef`) и teardown в `useEffect` cleanup.
- Состояние, читаемое в event handler-ах, должно быть в `useRef` (например, `openRef.current`), чтобы избежать stale closures.
- Отправка сообщений защищается синхронным ref (`sendingRef`), а не только React state.
- `postMessage` отправляется только на `getParentOrigin()` или явный allowlist; `'*'` запрещён в production.
- Все fetch-запросы с side-effect-ами поддерживают `AbortSignal` и отменяются при unmount/смене параметра.
- `VITE_BASE_PATH` и `VITE_API_URL` обязательно передаются в `npm run build` для production.

## 7. Сборка и деплой

- Скрипты не должны зависеть от `.bin` symlink: вызывать `tsc`/`jest`/`nest` через `node node_modules/.../lib/...js`.
- `npm install`/`npm ci` выполняется под `flock` и только один раз за деплой.
- Перед удалением `node_modules`/`dist` systemd-юниты фронтендов останавливаются; после завершения — `deploy_restore_node_services`.
- `.env` должен читаться в скриптах сборки (`set -a; source .env; set +a`) перед экспортом переменных.
- Каждый bash-скрипт:
  - `set -euo pipefail`;
  - проверка root/прав;
  - все переменные в `"${VAR}"`;
  - `rm -rf` только после проверки пути.
- Любое обращение к systemd/файлам должно быть защищено проверкой существования.

## 8. Тестирование

- Каждый баг-фикс сопровождается тестом или исправлением существующего теста.
- Моки Prisma должны отражать реальный API (например, `updateMany`, `$transaction` с callback).
- Линтер и тесты должны проходить локально до push:
  ```bash
  node node_modules/turbo/bin/turbo run lint
  node node_modules/turbo/bin/turbo run test
  ```

## 9. Code review checklist

- [ ] Нет `any` без обоснования.
- [ ] Нет не awaited Promise.
- [ ] Нет `findMany` без `take`.
- [ ] Все `update`/`delete` по ID включают tenant.
- [ ] Нет read-modify-write без атомарности.
- [ ] Все `@Public()` endpoint-ы имеют rate limit.
- [ ] Все bash-скрипты читают `.env` и проверяют пути.
- [ ] Тесты проходят.

## 10. Критичные антипаттерны (недопустимы)

| Антипаттерн | Почему опасно | Правильно |
|-------------|---------------|-----------|
| `catch { return { ok: false } }` | Прячет реальные ошибки | Логировать и re-throw, кроме ожидаемых |
| `await findFirst(); await create()` | Race condition | unique index + `upsert`/`try-catch P2002` |
| `this.prisma.x.update({ where: { id } })` | IDOR | `where: { id, tenantId }` |
| `setTimeout`/`setInterval` без cleanup | Утечки памяти | Очищать в `useEffect` cleanup |
| `tsc`/`jest` через `.bin` | Сломается на сервере | `node node_modules/.../lib/...js` |
| `npm install` без блокировки | Портит node_modules | `flock` + один раз за деплой |

