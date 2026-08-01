#!/usr/bin/env bash
# Быстрый фикс входа БЕЗ пересборки Docker (когда диск полон)
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/monstro_chat_ai}"
cd "${INSTALL_DIR}"

log() { echo -e "\n\033[1;32m==>\033[0m $*"; }

log "Настраиваю .env для HTTP-логина..."
grep -q '^COOKIE_SECURE=' .env 2>/dev/null && sed -i 's/^COOKIE_SECURE=.*/COOKIE_SECURE=false/' .env || echo 'COOKIE_SECURE=false' >> .env
grep -q '^NODE_ENV=' .env 2>/dev/null && sed -i 's/^NODE_ENV=.*/NODE_ENV=development/' .env || echo 'NODE_ENV=development' >> .env

log "Перезапускаю API (без пересборки)..."
docker compose up -d api

sleep 10

log "Создаю тестовых пользователей..."
if docker compose exec -T api test -f prisma/seed.ts 2>/dev/null; then
  docker compose exec -T api npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
elif docker compose exec -T api test -f prisma/dist/seed.js 2>/dev/null; then
  docker compose exec -T api node prisma/dist/seed.js
else
  echo "Seed-файл не найден в контейнере. Сначала освободите диск и пересоберите API."
  exit 1
fi

IP=$(curl -4 -s --max-time 3 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

echo ""
echo "=============================================="
echo "  ГОТОВО"
echo "=============================================="
echo "  Кабинет:  http://${IP}:5173"
echo "  Админка:  http://${IP}:5174"
echo ""
echo "  client@demo.local / Test1234!"
echo "  admin@chat24ai.local / Test1234!"
echo "=============================================="
