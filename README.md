# RedFlow

SaaS-платформа ИИ-агентов для консультирования посетителей сайта и автоматизированного сбора лидов.

## Структура монорепозитория

```
apps/
  api/           — NestJS backend API
  web-client/    — Личный кабинет клиента (React + Vite)
  web-admin/     — Админ-панель владельца (React + Vite)
  public-site/   — Публичный сайт (Sprint 16)
  widget/        — Виджет чата (Sprint 2)
packages/
  shared-types/  — Общие TypeScript-типы
```

## Быстрый старт

### Требования

- Node.js 20+
- Docker и Docker Compose

### 1. Установка зависимостей

```bash
npm install
```

### 2. Настройка окружения

```bash
cp .env.example .env
```

### 3. Запуск инфраструктуры

```bash
docker compose up -d postgres redis minio minio-init
```

### 4. Миграции БД

```bash
npm run db:generate
npm run db:migrate
```

### 5. Разработка

```bash
# API (порт 3000)
npm run dev -w @ai-consultant/api

# Личный кабинет (порт 5173)
npm run dev -w @ai-consultant/web-client

# Админка (порт 5174)
npm run dev -w @ai-consultant/web-admin
```

### Полный стек через Docker

```bash
docker compose up -d
```

## Health-check

- `GET /api/health` — общий статус
- `GET /api/health/db` — статус PostgreSQL
- `GET /api/health/redis` — статус Redis

## Спринт-план

Разработка ведётся по 17 спринтам согласно `AI-Consultant-Platform-MASTER.md`.

| Спринт | Статус | Описание |
|--------|--------|----------|
| Sprint 0 | ✅ | Инфраструктура, CI, health, миграции v1 |
| Sprint 1 | ✅ | Auth, JWT, RBAC, 2FA, trial 7 дней |
| Sprint 2 | ✅ | Источники, embed.js, виджет |
| Sprint 3 | ✅ | Краулинг, база знаний, эмбеддинги, вкладка «Обучение агента» |
| Sprint 4 | ✅ | AI Orchestrator, RAG-диалог, стриминг, провайдеры LLM |
| Sprint 5 | ✅ | Лиды, промпты, playground, anti-injection |
| Sprint 6 | ✅ | CRM: воронки, канбан, merge/assign, WS/email |
| Sprint 7 | ✅ | Тарифы, лимиты, триал, учёт расхода Redis/Postgres |
| Sprint 8 | ✅ | ЮKassa: оплата, webhooks, рекурренты, чеки |
| Sprint 9 | ✅ | Семантический кэш, роутинг моделей, маржа в админке |
| Sprint 10 | ✅ | UTM/ClientID, Метрика/GTM/GA4, офлайн-конверсии |
| Sprint 11 | ✅ | amoCRM/Bitrix24 OAuth, экспорт лидов, маппинг, retry |

## Лицензия

Proprietary. All rights reserved.
