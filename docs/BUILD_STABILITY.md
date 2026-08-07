# Стабильная сборка (Sprint 76)

## Почему падало `Cannot find module .../typescript/bin/tsc`

1. **Параллельный `npm install`** из `build-widget` / `build-frontends` / `build-site` одновременно писал в один `node_modules` → обрезанный/битый typescript (ETXTBSY).
2. **Skip install по stamp** `package-lock.json` без проверки, что `tsc` реально есть.
3. **Зависимость от `typescript/bin/tsc`** (.bin/symlink) — на VPS часто без +x или отсутствует.

## Почему был nginx 502 на админке/сайте

1. `deploy_stop_node_services` гасил `monstro-web-admin` / `public-site` перед npm.
2. `deploy_restart_if_active` поднимал unit **только если он уже active** → после `stop` сервис оставался down.
3. `fix-npm-install.sh` останавливал сервисы и **не поднимал** их обратно.
4. Stamp `package-lock` писался до успешного install → следующий деплой думал, что deps OK.

## Как работает сейчас

| Шаг | Поведение |
|-----|-----------|
| `fast-update.sh` | Перед параллельными фронтами: **один** `deploy_install_all_deps` + flock |
| Health-check | Есть и запускается `typescript/lib/tsc.js` + есть `esbuild` |
| Broken deps | Stop node-сервисов → `rm -rf node_modules` → `npm ci` |
| После npm/сборки | `deploy_ensure_service` = start **даже если inactive** |
| EXIT trap | При падении сборки сервисы всё равно поднимаются |
| `shared-types` | `run-tsc.cjs` ищет `lib/tsc.js` (не зависит от .bin) |
| Параллель | Только **сборка** (vite/next), не npm install |
| Stamp | Пишется только после успешного install |

## Если сейчас 502

```bash
cd /opt/monstro_chat_ai
git fetch origin && git checkout cursor/sprint-76-admin-lk-auth-ab3a && git pull
sudo bash scripts/recover-frontends.sh
# если dist нет / всё ещё 502:
sudo bash scripts/fast-update.sh --full --no-pull
```

## Полное восстановление deps + деплой

```bash
sudo bash scripts/fix-npm-install.sh
sudo bash scripts/fast-update.sh --full --no-pull
```
