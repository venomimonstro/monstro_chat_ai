# Sprint 75 — Chat Reliability Audit

Дата: 2026-08-07  
Фокус: чат «недоступен», обрывы сессии, reconnect, origin deny

## Корневые причины (почему продукт выглядел сломанным)

1. **Origin allowlist проверял Origin iframe (`:5175`), а в настройках указывали сайт клиента** → в production join отклонялся с `origin_not_allowed`, UI писал «Нет соединения».
2. **При сворачивании вкладки виджет делал hard disconnect** → «Соединение прервано» посреди ответа.
3. **После 5 попыток reconnect socket.io сдавался навсегда**.
4. **Устаревший `dialogId` в localStorage** ломал сообщения без восстановления.
5. **CORS** блокировал fetch config/ping с сайта клиента (родительская страница).
6. **Join rate-limit** сжигал лимит при каждом reconnect (tab switch).

---

## Исправления в PR

| Область | Фикс |
|---------|------|
| `widget-origin.util.ts` | Всегда разрешать `WIDGET_URL`; allowlist проверять через `parentOrigin` |
| `chat.gateway.ts` | parentOrigin в join/message; join без disconnect на origin deny; history до `joined`; re-join без rate-limit; NotFound → `dialog_not_found`; session token после create |
| `follow-up-push` | Один emit в `visitor:` (без дублей) |
| `main.ts` + widget controller | CORS/ACAO для embed с сайтов клиентов |
| `WidgetApp.tsx` | Infinite reconnect; connected только после `joined`; нет hard disconnect на hide; recovery dialog_not_found; понятные ошибки; timeout 8с |
| Source settings copy | Уточнено про iframe host |
| `deploy/nginx-widget-websocket.conf.example` | Upgrade headers для Socket.IO |

---

## Что проверить после деплоя

1. Открыть виджет на HTTPS-сайте клиента → чат должен подключаться (Онлайн).
2. Свернуть вкладку на 30с во время ответа → reconnect без «навсегда недоступен».
3. Отправить сообщение после долгого простоя → ответ приходит.
4. В ЛК: allowlist = `https://ваш-сайт.ru` (без :5175).

---

## Важно для HTTPS-сайтов клиентов

Если сайт клиента на HTTPS, а виджет на `http://IP:5175`, браузер блокирует mixed content.  
Нужен HTTPS для виджета (см. `deploy/nginx-widget-websocket.conf.example`).

```bash
# Пример embed URL после TLS:
# https://redflow.ru/embed.js  (прокси на :5175)
```

---

## Деплой

```bash
cd /opt/monstro_chat_ai
git fetch origin
git checkout cursor/sprint-75-chat-reliability-ab3a
git pull origin cursor/sprint-75-chat-reliability-ab3a
sudo bash scripts/fast-update.sh --full --no-pull
```
