# Release pipeline (Sprint 33+)

## Workflow

1. **Админка → Обновления** — зарегистрировать релиз (номер спринта + версия `0.N.0`)
2. **Проверить (staging)** — health + verify-release + smoke-тесты
3. **Одобрить выкатку** — создаётся бэкап, статус `awaiting_approval`
4. **На сервере** — выполнить команду деплоя (показана в админке)
5. Скрипт делает pre/post проверки; при ошибке — **авто-откат**

## Команды на сервере

```bash
# Полный деплой с проверками (рекомендуется)
sudo RELEASE_UPDATE_ID=<uuid> RELEASE_DEPLOY_TOKEN=<token> \
  bash /opt/monstro_chat_ai/scripts/release-deploy.sh 0.33.0 33

# Откат на предыдущую версию
sudo RELEASE_DEPLOY_TOKEN=<token> \
  bash /opt/monstro_chat_ai/scripts/release-rollback.sh

# Только проверка
bash /opt/monstro_chat_ai/scripts/verify-release.sh
```

`RELEASE_DEPLOY_TOKEN` — из `.env` на сервере.

## Переменные окружения

| Переменная | Описание |
|------------|----------|
| `APP_VERSION` | Текущая версия (0.33.0) |
| `SPRINT_NUMBER` | Номер спринта |
| `RELEASE_DEPLOY_TOKEN` | Токен для скриптов деплоя |
| `DEPLOY_MODE` | `mock` (dev) или `script` (prod) |

## Проверки verify-release.sh

<<<<<<< Updated upstream
- `/api/health` + версия
- `/api/health/db` — PostgreSQL
- `/api/health/redis` — Redis
- `/api/public/demo-widget` — актуальный API
- `/api/public/release` — sprint/version
- Админка :5174, сайт :4321
=======
```bash
bash scripts/verify-release.sh pre              # перед деплоем: health + DB + Redis
bash scripts/verify-release.sh post 0.33.0 33   # после: полная проверка версии
```
>>>>>>> Stashed changes

## Откат

- **Админка → Обновления** — кнопка «Откатить» на применённом релизе
- **CLI** — `scripts/release-rollback.sh`

## Спринты

Список спринтов: **Админка → Спринты** (из `docs/SPRINTS.md`).
