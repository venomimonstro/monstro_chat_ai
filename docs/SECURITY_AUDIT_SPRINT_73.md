# Sprint 73 — Security Audit Report

Дата: 2026-08-06  
Охват: посетитель сайта, клиент платформы (tenant), админ/владелец, публичные API, виджет, аналитика.

## Резюме

| Уровень | Найдено | Исправлено в PR |
|---------|---------|-----------------|
| CRITICAL | 4 | 4 |
| HIGH | 8 | 6 |
| MEDIUM | 12 | 2 |
| LOW | 10 | 0 (документировано) |

---

## CRITICAL — исправлено

### C1. CSRF отключён для всех `/api/admin/*`
**Риск:** CSRF-атака на заблокировку тенантов, изменение баланса, деплой, восстановление бэкапов.  
**Исправление:** убран префикс `/api/admin` из skip-list; оставлены только machine-to-machine пути (`/api/admin/release/*`, impersonation exchange). Удалён bypass «любой 64-hex заголовок + cookie сессии».

### C2. JWT не проверял `sessionVersion` и `user.status`
**Риск:** после сброса пароля/блокировки украденный access-токен работал до истечения TTL (15 мин).  
**Исправление:** `sessionVersion` в payload JWT; `JwtStrategy.validate()` проверяет статус и версию в БД.

### C3. PostgreSQL RLS не применялся (middleware до JWT guard)
**Риск:** RLS-политики с `current_setting IS NULL` пропускали все строки; изоляция только на уровне приложения.  
**Исправление:** `TenantContextInterceptor` (APP_INTERCEPTOR) устанавливает контекст после аутентификации и сбрасывает после завершения запроса.

### C4. Impersonation exchange — публичный endpoint без rate limit
**Риск:** утечка exchange code → полная сессия тенанта с `twoFaVerified: true`.  
**Исправление:** rate limit 10/min, TTL по умолчанию снижен с 3600 до 300 с, `sessionVersion` в impersonation JWT.

---

## HIGH — исправлено

### H1. Cross-cookie JWT fallback (admin ↔ client)
**Исправление:** `JwtStrategy` использует только cookie своего приложения (без fallback).

### H2. Brute-force 2FA после успешного пароля
**Исправление:** rate limit 5 попыток / 15 мин на `userId`; сброс login attempts только после успешной 2FA.

### H3. IDOR в reorder pipeline statuses
**Исправление:** проверка что все `orderedIds` принадлежат `pipelineId` тенанта.

### H4. YooKassa webhook без подписи
**Исправление:** fail-closed — отклонять webhook если secret не настроен.

### H5. Diagnostics token предсказуем при недоступном Redis
**Исправление:** в production возвращать `false` если Redis недоступен.

### H6. SSRF в crawler через redirect
**Исправление:** `redirect: 'manual'` с валидацией каждого hop; `host.docker.internal` заблокирован.

### H7. Telegram webhook без аутентификации
**Исправление:** `secret_token` при `setWebhook`, проверка `X-Telegram-Bot-Api-Secret-Token`.

### H8. Analytics: `tenantId` игнорировался при `dimension=tenant`
**Исправление:** при переданном `tenantId` возвращаются данные только этого тенанта.

---

## HIGH — отложено (требует отдельного спринта)

| ID | Проблема | Рекомендация |
|----|----------|--------------|
| H9 | Widget `visitorId` без криптографической привязки | Подписанный visitor token при первой загрузке |
| H10 | Impersonation code в URL query string | POST-only exchange с привязкой к admin session |
| H11 | Redis fail-open на auth rate limits | Fail-closed в production |
| H12 | Outgoing webhook SSRF (tenant URL) | Allowlist https + block private IPs |

---

## MEDIUM — отложено

- `disable2fa` / `setup2fa` без step-up auth (пароль + TOTP)
- Нет rate limit на `forgot-password`, `register`, `refresh`
- Shared `refresh_token` cookie между admin и client
- `resolveAppKind` доверяет spoofable Origin/Referer
- Analytics schedules без class-validator DTO
- Analytics date range без max span (DoS)
- VK webhook без signature verification
- File upload без Multer size limit
- Widget CORS `origin: *` на WS namespace
- postMessage open/close без origin check

---

## LOW — информационно

- Admin custom scripts = intentional XSS при компрометации админа
- Bearer token в Authorization header обходит SameSite
- `SKIP_2FA_ENFORCEMENT` env bypass
- Admin WS gateway `origin: true`
- Bulk block `reason` без min length

---

## Матрица рисков по персонам

| Персона | Главные риски (до фикса) |
|---------|--------------------------|
| Посетитель | Widget visitor hijack, fake Telegram messages |
| Клиент | Cross-tenant leak при ошибке в сервисе, 2FA brute-force |
| Админ | CSRF на все мутации, impersonation code leak |

---

## Проверенные области без критических находок

- SQL injection в analytics (`Prisma.sql` parameterization)
- Tenant analytics controller (`user.tenantId` из JWT)
- CRM leads scoping по `tenantId`
- OAuth redirects (фиксированный `WEB_CLIENT_URL`)
- Widget JWT `purpose: widget-session` отклоняется JwtStrategy
- React text escaping в чате (нет stored XSS)

---

## Деплой

```bash
cd /opt/monstro_chat_ai
git fetch origin
git checkout cursor/sprint-73-security-audit-ab3a
git pull
sudo bash scripts/fast-update.sh --full --no-pull
```

**Важно:** после деплоя переподключите Telegram-каналы (для `secret_token`).  
Существующие JWT-сессии инвалидируются при следующем запросе (проверка `sessionVersion`).
