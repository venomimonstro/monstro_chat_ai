# Stable release (sprints 68–76 consolidated)

Ветка: `cursor/release-stable-ab3a` → merge into `main`.

## Что вошло (проверено)

| Sprint | Содержание | Статус |
|--------|------------|--------|
| 76 | Auth hang (CSRF deadlock), multi-origin CORS, deploy 502 fix, run-tsc, recover-frontends | база |
| 75 | Chat reliability: origin/reconnect/session | merged |
| 73 | Security: CSRF не skip /api/admin, JWT sessionVersion, tenant RLS | security-only |
| 74 | ChatsPage/CRM/message dedupe (UI) | cherry-pick |
| 70 | nginx/SSL redflow.ru, brand, vite base | scripts only |
| 69 | Launcher customization | types + UI |
| 68 | Smart crawl strategy | API + types |

## Намеренно не брали / superseded

- Deploy-скрипты из 70/73 → **только 76** (`deploy_ensure_service`, restore после npm)
- Auth из 68/72 → **только 76**
- Полный tip 73/74 с conflict markers в jwt → переписан чисто
- Sprint 71 stream batching — опционально позже (конфликт с 75 WidgetApp)

## Чистая установка на сервере

```bash
cd /opt/monstro_chat_ai   # или /opt/redflow
git fetch origin
git checkout main
git reset --hard origin/main
sudo bash scripts/fix-npm-install.sh
sudo bash scripts/fast-update.sh --full --no-pull
# если 502:
sudo bash scripts/recover-frontends.sh
# SSL redflow.ru (если нужно):
# sudo bash scripts/setup-ssl-redflow.sh
```

## Smoke-check после деплоя

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/api/health
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5174/
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4321/
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5175/embed.js
systemctl is-active monstro-web-admin monstro-public-site monstro-widget
```
