# Stable release (sprints 68–77 consolidated)

Ветка: `main` (merged).

## Что вошло (проверено)

| Sprint | Содержание | Статус |
|--------|------------|--------|
| 68 | Умный краулер обучения | API + types |
| 69 | Кастомизация лаунчера виджета | types + UI |
| 70 | nginx/SSL redflow.ru, brand, vite base | scripts only |
| 73 | Security: CSRF не skip /api/admin, JWT sessionVersion, tenant RLS | security-only |
| 74 | ChatsPage/CRM/message dedupe (UI) | cherry-pick |
| 75 | Chat reliability: origin/reconnect/session | merged |
| 76 | Auth hang, multi-origin CORS, deploy 502 fix, run-tsc, recover-frontends | база |
| 77 | `GET /api/auth/me` fix, Vite base paths for /admin/ /app/, diagnostic agent | fixes |

## Критические баги, исправленные в 77

1. `GET /api/auth/me` был `@Post('me')` — админка/ЛК зависали на «Загрузка...» при 404.
2. `VITE_BASE_PATH` не проставлялся для `/admin/` и `/app/` — ассеты уходили на публичный сайт.
3. `deploy_export_frontend_env` перезаписывал `VITE_API_URL` на HTTP-IP вместо production HTTPS-домена.
4. Диагностический агент теперь фиксирует состояние деплоя и сразу показывает ошибки.

## Чистая установка / принудительный деплой

```bash
cd /opt/monstro_chat_ai   # или /opt/redflow
git fetch origin
git checkout main
git reset --hard origin/main
sudo bash scripts/force-deploy-main.sh
# или вручную:
# sudo bash scripts/fix-npm-install.sh
# sudo bash scripts/fast-update.sh --full --no-pull
# sudo bash scripts/recover-frontends.sh
```

## Диагностика

```bash
# Ручной запуск
sudo bash scripts/aicw-diagnose.sh --full

# Просмотр отчёта
journalctl -u aicw-diagnose -n 50

curl -s https://redflow.ru/api/diagnostic | python3 -m json.tool
# или на сервере:
curl -s http://127.0.0.1:3000/api/diagnostic
```

## Smoke-check

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://redflow.ru/api/health
curl -s -o /dev/null -w '%{http_code}\n' https://redflow.ru/admin/
curl -s -o /dev/null -w '%{http_code}\n' https://redflow.ru/app/
curl -s -o /dev/null -w '%{http_code}\n' https://redflow.ru/
curl -s -o /dev/null -w '%{http_code}\n' https://redflow.ru/embed.js
systemctl is-active monstro-web-admin monstro-web-client monstro-public-site monstro-widget
```
