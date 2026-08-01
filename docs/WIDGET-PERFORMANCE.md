# Производительность виджета — рекомендации для клиентов

Виджет AI Consultant спроектирован так, чтобы **минимально влиять** на Core Web Vitals вашего сайта (LCP, INP, CLS).

## Как подключить правильно

```html
<script>
(function(w,d,s,o,f,js,fjs){
  w['AIConsultantWidget']=o;w[o]=w[o]||function(){(w[o].q=w[o].q||[]).push(arguments)};
  js=d.createElement(s),fjs=d.getElementsByTagName(s)[0];
  js.id=o;js.src=f;js.async=1;js.defer=1;fjs.parentNode.insertBefore(js,fjs);
}(window,document,'script','aicw','https://cdn.your-domain.com/widget/embed.js'));
aicw('init', { widgetKey: 'YOUR_WIDGET_KEY', lazyLoad: true });
</script>
```

### Обязательно

| Правило | Зачем |
|---------|-------|
| `async` + `defer` на теге скрипта | Не блокирует парсинг HTML |
| `lazyLoad: true` (по умолчанию) | 0 запросов к API до клика посетителя |
| Скрипт перед `</body>` | Меньше конкуренции за main thread при LCP |

### Не делайте

- Не подключайте виджет в `<head>` без `async`/`defer`
- Не дублируйте скрипт на одной странице
- Не оборачивайте в синхронный loader, блокирующий рендер

## Архитектура загрузки

```
embed.js (≤ 8 KB gzip)
    │
    ├─ lazyLoad: true → кнопка-лаунчер (inline CSS, 0 iframe)
    │       └─ клик → preconnect → iframe + React bundle
    │
    └─ lazyLoad: false → requestIdleCallback → iframe (без API до idle)

iframe (React)
    ├─ initial chunk ≤ 120 KB gzip
    ├─ socket.io-client — отдельный chunk, грузится при открытии чата
    └─ WebSocket — только после открытия панели (deferSocket)
```

## Настройка `behavior.lazyLoad`

В ЛК → Источники → настройки виджета:

- **`lazyLoad: true`** (рекомендуется) — ping и конфиг не запрашиваются до первого клика. Лучше для SEO и скорости сайта.
- **`lazyLoad: false`** — iframe предзагружается в idle, ping фиксирует установку скрипта сразу. Используйте, если критично отслеживать установку без взаимодействия.

## CDN и кэширование

Для hashed-ассетов (`/assets/*`) используйте:

```
Cache-Control: public, max-age=31536000, immutable
```

Для `embed.js`:

```
Cache-Control: public, max-age=3600
```

Файл `public/_headers` в пакете виджета содержит готовые правила для Cloudflare Pages / Netlify.

### Nginx (пример)

```nginx
location /widget/assets/ {
  add_header Cache-Control "public, max-age=31536000, immutable";
}

location = /widget/embed.js {
  add_header Cache-Control "public, max-age=3600";
}
```

## Preconnect

`embed.js` автоматически добавляет `<link rel="preconnect">` к CDN виджета и API **при hover/focus на кнопку** — не раньше.

## API для SPA-сайтов

При навигации в одностраничном приложении:

```javascript
// Перед уходом со страницы (опционально)
aicw('destroy');
```

Это удаляет iframe, таймеры и кнопку-лаунчер без утечек памяти.

## Целевые метрики

| Метрика | Цель |
|---------|------|
| embed.js gzip | ≤ 8 KB |
| iframe initial JS gzip | ≤ 120 KB |
| Добавка к TBT (3G Fast) | < 50 ms |
| Lighthouse Performance (демо-страница) | ≥ 95 |

## Проверка у себя

1. Откройте DevTools → Network → фильтр до клика на чат: при `lazyLoad: true` не должно быть запросов к `/api/widget/*`.
2. Lighthouse → Performance на странице с виджетом.
3. Chrome DevTools → Memory: 50 циклов open/close — heap не должен расти линейно.

## Поддержка браузеров

Последние 2 версии Chrome, Firefox, Safari, Edge. Полифиллы для IE не включены.
