# Release pipeline (Sprint 33+)

## Workflow

1. **Админка → Обновления** — зарегистрировать релиз (номер спринта + версия `0.N.0`)
2. **Проверить (staging)** — health + verify-release + smoke-тесты
3. **Одобрить выкатку** — создаётся бэкап, статус `awaiting_approval`
4. **На сервере** — выполнить команду деплоя (показана в админке)
5. Скрипт делает pre/post проверки; при ошибке — **авто-откат**

## Команды на сервере

```bash
# РЕКОМЕНДУЕТСЯ — автоматически берёт последний спринт из SPRINTS.md
sudo bash /opt/redflow/scripts/deploy-latest.sh

# Или вручную с версией
sudo bash /opt/redflow/scripts/release-deploy.sh 0.34.0 34
```

**Не используйте старые команды** из админки для Sprint 31/32 — они вызовут ошибку версии.

# Откат на предыдущую версию
sudo RELEASE_DEPLOY_TOKEN=$(grep RELEASE_DEPLOY_TOKEN .env | cut -d= -f2) \
  bash /opt/redflow/scripts/release-rollback.sh

# Только проверка
bash /opt/redflow/scripts/verify-release.sh post 0.33.0 33
```

`RELEASE_DEPLOY_TOKEN` — из `.env` на сервере. **Обязателен** для корректной синхронизации версии в API.

## Важно

- **Не выкатывайте старую версию поверх новой.** Если на сервере уже `0.33.0`, команда `release-deploy.sh 0.32.0 32` завершится ошибкой.
- Версия в `/api/health` берётся из Redis (manifest). Скрипт синхронизирует её **до** post-проверки.
- `{"message":"Unauthorized"}` на защищённых эндпоинтах без токена — это нормально. Для health используйте `/api/health` (без авторизации).

## Переменные окружения

| Переменная | Описание |
|------------|----------|
| `APP_VERSION` | Текущая версия (0.33.0) |
| `SPRINT_NUMBER` | Номер спринта |
| `RELEASE_DEPLOY_TOKEN` | Токен для скриптов деплоя |
| `FORCE_DEPLOY` | `1` — разрешить выкат старой версии (не рекомендуется) |

## Проверки verify-release.sh

```bash
bash scripts/verify-release.sh pre              # перед деплоем: health + DB + Redis
bash scripts/verify-release.sh post 0.33.0 33   # после: полная проверка версии
```

- `/api/health` + версия
- `/api/health/db` — PostgreSQL
- `/api/health/redis` — Redis
- `/api/public/demo-widget` — актуальный API
- `/api/public/release` — sprint/version
- Админка :5174, сайт :4321

## Откат

- **Админка → Обновления** — кнопка «Откатить» на применённом релизе
- **CLI** — `scripts/release-rollback.sh`

## Спринты

Список спринтов: **Админка → Спринты** (из `docs/SPRINTS.md`).
