#!/usr/bin/env bash
# Полная настройка: API env, пользователи, фронтенд, публичный сайт
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/monstro_chat_ai}"
cd "${INSTALL_DIR}"

log()  { echo -e "\n\033[1;32m==>\033[0m $*"; }
warn() { echo -e "\033[1;33m!!\033[0m $*"; }

IP=$(curl -4 -s --max-time 3 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

log "1/5 Настройка .env для HTTP..."
cat >> .env <<EOF

# bootstrap $(date -Iseconds)
NODE_ENV=development
COOKIE_SECURE=false
SKIP_2FA_ENFORCEMENT=true
WEB_CLIENT_URL=http://${IP}:5173
WEB_ADMIN_URL=http://${IP}:5174
WIDGET_URL=http://${IP}:5175
PUBLIC_SITE_URL=http://${IP}:4321
API_PUBLIC_URL=http://${IP}:3000/api
EOF

# dedupe keys — keep last values
awk -F= '!seen[$1]++ || NF==1' .env > .env.tmp && mv .env.tmp .env

log "2/5 Запуск API..."
docker compose up -d postgres redis minio api
sleep 15

if ! curl -sf http://localhost:3000/api/health >/dev/null; then
  warn "API не отвечает — освободите диск: bash scripts/free-disk.sh"
  docker compose logs api --tail 20
  exit 1
fi

log "3/5 Создание тестовых пользователей..."
docker compose cp scripts/seed-inline.cjs api:/app/prisma/seed-inline.cjs
docker compose exec -T api node prisma/seed-inline.cjs

log "4/5 Проверка логина через API..."
LOGIN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"client@demo.local","password":"Test1234!"}')
echo "$LOGIN" | grep -q '"email"' || { echo "$LOGIN"; exit 1; }
echo "OK: client login works"

log "5/6 Запуск фронтенда, виджета и публичного сайта..."
bash scripts/start-widget.sh || warn "Виджет не запустился"
bash scripts/start-frontend.sh || warn "Фронтенд не запустился — проверьте место на диске"
bash scripts/start-public-site.sh || warn "Публичный сайт не запустился"

echo ""
echo "=============================================="
echo "  ВСЁ ГОТОВО"
echo "=============================================="
echo ""
echo "  Публичный сайт:  http://${IP}:4321"
echo "  Кабинет:         http://${IP}:5173"
echo "  Админка:         http://${IP}:5174"
echo "  API:             http://${IP}:3000/api/health"
echo ""
echo "  Логин клиента:   client@demo.local / Test1234!"
echo "  Логин админа:    admin@chat24ai.local / Test1234!"
echo ""
echo "  Или зарегистрируйтесь: http://${IP}:5173/register"
echo "=============================================="
