# Стабильная сборка (Sprint 76)

## Почему падало `Cannot find module .../typescript/bin/tsc`

1. **Параллельный `npm install`** из `build-widget` / `build-frontends` / `build-site` одновременно писал в один `node_modules` → обрезанный/битый typescript (ETXTBSY).
2. **Skip install по stamp** `package-lock.json` без проверки, что `tsc` реально есть.
3. **Зависимость от `typescript/bin/tsc`** (.bin/symlink) — на VPS часто без +x или отсутствует.

## Как работает сейчас

| Шаг | Поведение |
|-----|-----------|
| `fast-update.sh` | Перед параллельными фронтами: **один** `deploy_install_all_deps` + flock |
| Health-check | Есть и запускается `typescript/lib/tsc.js` + есть `esbuild` |
| Broken deps | Stop node-сервисов → `rm -rf node_modules` → `npm ci` |
| `shared-types` | `run-tsc.cjs` ищет `lib/tsc.js` (не зависит от .bin) |
| Параллель | Только **сборка** (vite/next), не npm install |
| shared-types | Собирается **один раз** до parallel |

## Если сборка уже сломана на сервере

```bash
cd /opt/monstro_chat_ai
git fetch origin && git checkout cursor/sprint-76-admin-lk-auth-ab3a && git pull
sudo bash scripts/fix-npm-install.sh
sudo bash scripts/fast-update.sh --full --no-pull
```

`fix-npm-install.sh` останавливает фронт-сервисы, чистит `node_modules`, делает `npm ci`, проверяет tsc/esbuild.
