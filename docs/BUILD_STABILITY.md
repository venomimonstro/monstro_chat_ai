# Стабильная сборка (Sprint 76)

## Почему падало `Cannot find module .../typescript/bin/tsc`

1. **Параллельный `npm install`** из `build-widget` / `build-frontends` / `build-site` одновременно писал в один `node_modules` → обрезанный/битый typescript (ETXTBSY).
2. **Skip install по stamp** `package-lock.json` без проверки, что `tsc` реально есть.
3. **Зависимость от `typescript/bin/tsc`** (.bin/symlink) — на VPS часто без +x или отсутствует.

## Почему был nginx 502 на админке/сайте

1. ~~`deploy_stop_node_services` гасил фронты перед npm~~ → **исправлено (Sprint 82):** сервисы остаются online.
2. Сборка писала прямо в `dist/` / `.next` пока nginx отдавал старые файлы.
3. `fix-npm-install.sh` останавливал сервисы и **не поднимал** их обратно.
4. Stamp `package-lock` писался до успешного install → следующий деплой думал, что deps OK.

## Как работает сейчас (Sprint 82 — zero-downtime)

| Шаг | Поведение |
|-----|-----------|
| `fast-update.sh` | Перед параллельными фронтами: **один** `deploy_install_all_deps` + flock |
| npm ci | **Без остановки** фронт-сервисов; `NPM_CONFIG_LOGLEVEL=error` (deprecated warnings скрыты) |
| Сборка | В **staging** (`.deploy/staging/`), затем **атомарный mv** в `dist/` / `.next` |
| Keepalive | Фоновый цикл поднимает упавшие фронты во время деплоя |
| Health-check | Есть и запускается `typescript/lib/tsc.js` + есть `esbuild` |
| Broken deps | `rm -rf node_modules` → `npm ci` (сервисы online) |
| После swap | `deploy_ensure_service` = быстрый restart |
| EXIT trap | При падении сборки сервисы всё равно поднимаются |
| `shared-types` | `run-tsc.cjs` ищет `lib/tsc.js` (не зависит от .bin) |
| Параллель | Только **сборка** (vite/next), не npm install |
| Stamp | Пишется только после успешного install |

### npm warn deprecated

Сообщения `npm warn deprecated inflight/glob/whatwg-encoding` — **норма** для транзитивных зависимостей, не ошибка деплоя.

## Если сейчас 502

```bash
cd /opt/monstro_chat_ai
git fetch origin && git reset --hard origin/main
sudo bash scripts/emergency-recover-502.sh
```

## Полное восстановление deps + деплой

```bash
sudo bash scripts/fix-npm-install.sh
sudo bash scripts/fast-update.sh --full --no-pull
```
