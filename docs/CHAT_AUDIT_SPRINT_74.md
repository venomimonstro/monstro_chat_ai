# Sprint 74 — Chat UX Audit & Fixes

Дата: 2026-08-06  
Фокус: глючный чат (виджет + ЛК оператора)

## Симптомы от пользователей

- Ответ ассистента не появляется (типинг есть — текста нет)
- Чат зависает «Ожидайте ответ…» после обрыва сети
- Дубли сообщений после reconnect
- Скролл прыгает при чтении истории
- Follow-up приходит дважды
- В ЛК: поиск дёргает список, при быстром переключении диалогов — чужие сообщения

---

## Исправлено в PR

### Виджет (`WidgetApp.tsx`)

| Баг | Фикс |
|-----|------|
| `stream:end` без streaming bubble — ответ терялся | Добавление assistant message если есть content |
| `isTyping` зависал после disconnect | Всегда сбрасывать на disconnect + timeout 90с |
| RAF после stream:end создавал пустой bubble | cancelStreamFlush на end/error/disconnect |
| История при reconnect игнорировалась | mergeChatHistory вместо skip |
| Disconnect при сворачивании вкладки | Убран hard disconnect на visibility hidden |
| Rate limit оставлял ghost user message | Откат optimistic user bubble |
| Дубли user local vs server id | dedupeMessages по content+role |
| reconnect_failed без UI | Обработчик → connectionError |

### Scroll (`useChatScroll.ts`)

- Автоскролл только если пользователь уже у низа (pinned)

### API (`follow-up-push.service.ts`)

- Follow-up только в `visitor:` room (было два emit → дубли)

### ЛК (`ChatsPage.tsx`)

- Debounce поиска 350ms
- Race guard при смене диалога (cancelled flag)
- Polling сообщений каждые 20с для активного диалога
- Ссылка «Открыть лид» → `/crm?leadId=...`
- Сохранение выбранного диалога при фильтрации

### CRM (`CrmPage.tsx`)

- Открытие лида по `?leadId=` из чата

---

## Отложено (следующие спринты)

- Operator reply UI в ЛК (сейчас read-only)
- WebSocket live updates вместо polling
- Виртуализация длинных транскриптов
- Widget visitorId cryptographic binding
- Отдельный liveStream state (как в Sprint 71) для perf на длинных ответах

---

## Тесты

- `apps/widget/src/utils/messages.test.mts` — dedupe + merge history

## Деплой

```bash
git fetch origin
git checkout cursor/sprint-74-chat-audit-ab3a
git pull
sudo bash scripts/fast-update.sh --full --no-pull
```
