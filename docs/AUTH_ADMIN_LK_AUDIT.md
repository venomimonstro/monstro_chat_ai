# Sprint 76 — Аудит авторизации админки и ЛК

## Симптом

Админка зависает на «Загрузка...» — форма логина не появляется.

## Корневые причины

1. **CSRF deadlock**  
   `AuthProvider` → `ensureCsrfToken()` → при пустом CSRF вызывал `POST /auth/refresh` → axios interceptor снова ждал `ensureCsrfToken()` → взаимная блокировка.

2. **Нет timeout**  
   Без `axios.timeout` и safety-timeout на bootstrap при недоступном API экран «Загрузка...» оставался навсегда.

3. **CORS / cookie app-kind**  
   Exact-match Origin ломал доступ с IP и с `https://domain/admin` (Origin без path). Cookie admin vs client выбиралась через `startsWith(WEB_ADMIN_URL)` и ошибочно писалась в client-cookie.

## Исправления

| Слой | Что сделано |
|------|-------------|
| `web-admin` / `web-client` `api.ts` | CSRF без refresh внутри `ensureCsrfToken`; mutex; exempt auth URLs; timeout 15s; заголовок `X-AICW-App` |
| `auth.tsx` | Bootstrap: сначала `/auth/me`, CSRF после успеха; safety timeout 12s |
| `ProtectedRoute` | Подсказка при зависшей загрузке |
| API `app-urls.util` | `WEB_*_URLS`, multi-origin CORS, shared-host match |
| API `resolveAppKind` | Origin / Referer / `X-AICW-App` / sticky admin cookie |

## Деплой

```bash
cd /opt/monstro_chat_ai
git fetch origin && git checkout cursor/sprint-76-admin-lk-auth-ab3a && git pull
# в .env при необходимости:
# WEB_ADMIN_URLS=https://redflow.ru/admin,http://31.128.42.106:5174,http://31.128.42.106
sudo bash scripts/fast-update.sh --full --no-pull
```
