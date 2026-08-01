# Regression checklist (UC-01 – UC-17)

Спринт 16 — ручной прогон на staging перед релизом.

| ID | Сценарий | Статус |
|----|----------|--------|
| UC-01 | Успешный сбор лида из диалога | ☐ |
| UC-02 | Дедупликация лида по телефону/email | ☐ |
| UC-03 | Обучение базы знаний (crawl + embeddings) | ☐ |
| UC-04 | RAG-ответ с цитированием контекста | ☐ |
| UC-05 | Anti-injection блокирует jailbreak | ☐ |
| UC-06 | CRM kanban: смена статуса, назначение | ☐ |
| UC-07 | Trial expiry блокирует виджет | ☐ |
| UC-08 | YooKassa checkout и webhook | ☐ |
| UC-09 | Semantic cache hit снижает LLM-вызов | ☐ |
| UC-10 | UTM/Metrika offline conversion | ☐ |
| UC-11 | amoCRM export + retry | ☐ |
| UC-12 | Двусторонняя синхронизация статусов CRM | ☐ |
| UC-13 | Admin: block tenant, impersonation | ☐ |
| UC-14 | Blue-green deploy + rollback | ☐ |
| UC-15 | Analytics dashboard + CSV export | ☐ |
| UC-16 | Регистрация с согласием ПД и tariffId | ☐ |
| UC-17 | Удаление тарифа с подписчиками запрещено | ☐ |

## Автотесты

- `npm test -w @ai-consultant/api` — unit-тесты (включая tenant-isolation)
- `npm run test -w e2e` — smoke health checks
- `npm run test:e2e -w e2e -- --project=visitor` — публичный сайт (посетитель)
- `npm run test:e2e -w e2e -- --project=client` — личный кабинет клиента (нужен seed)
- `npm run test:e2e -w e2e -- --project=admin` — админ-панель (нужен seed)
- `k6 run load-tests/api-health.k6.js` — нагрузка API

### QA-аккаунты (после `npm run db:seed -w @ai-consultant/api`)

| Роль | Email | Пароль по умолчанию |
|------|-------|---------------------|
| Админ платформы | `admin@chat24ai.local` | `Test1234!` (или `SEED_PASSWORD`) |
| Клиент (демо-тенант) | `client@demo.local` | `Test1234!` |

Перед E2E: поднять Postgres/Redis, `db:migrate`, `db:seed`, затем API + public-site + web-client + web-admin.

## Безопасность

- Dependabot/Snyk — сканирование зависимостей в CI
- `tenant-isolation.spec.ts` — проверка фильтрации по tenantId
- OWASP ZAP — рекомендуется прогон на staging перед продакшеном
