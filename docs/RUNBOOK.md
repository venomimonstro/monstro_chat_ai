# Runbook AI-Консультант

## 1. Развёртывание

### Docker Compose (production-like)

```bash
docker compose up -d
```

Миграции применяются отдельным одноразовым сервисом `migrate` перед стартом API. Проверка:

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/health/db
curl http://localhost:3000/api/health/redis
```

### Ручная миграция

```bash
npm run db:migrate
```

## 2. Откат релиза

### Blue-green откат

```bash
./scripts/rollback-version.sh <previous-version>
```

Скрипт переключает docker compose на предыдущую стабильную версию.

### Быстрый откат БД

```bash
./scripts/restore.sh <snapshot-id>
```

Требует существующего бэкапа из `/admin/backups`.

## 3. Частые инциденты

### API возвращает 500 на всех запросах

1. Проверить `docker compose ps`
2. Проверить health: `curl /api/health/db` и `/api/health/redis`
3. Если PostgreSQL недоступен — проверить диск и логи контейнера
4. Если Redis недоступен — сервисы работают в graceful-degradation, но rate-limit и кэш отключены

### Trial expired виджет не работает

- Ожидаемое поведение: `trial_expired` сообщение в виджете
- Для продления: клиент оформляет оплату в `/billing`

### CRM синхронизация "застряла"

1. Проверить `WebhookLog` в админке
2. Проверить блокировку `crm:sync:lock:{leadId}` в Redis
3. Принудительно сбросить lock: `DEL crm:sync:lock:<leadId>`
4. Вызвать retry из админки или `/integrations/crm/retry/:leadId`

## 4. Ротация секретов

1. JWT_SECRET: сгенерировать новый, обновить `.env`, перезапустить API
   Внимание: активные access-токены сразу инвалидируются.
2. Access/CSRF cookies: при смене `JWT_SECRET` пользователи будут разлогинены; refresh cookie path `/api/auth`.
3. INTEGRATION_ENCRYPTION_KEY: требует ре-шифрования credentials, см. `docs/SECURITY.md`.
3. YOOKASSA_SECRET_KEY: обновить в `.env` и перезапустить API.

## 5. Мониторинг

- Логи: `docker compose logs -f api`
- Метрики: health endpoints, k6 load tests
- Структурированные логи включают `correlationId` для трассировки запросов

## 6. Контакты

- On-call: TODO
- Slack: TODO
