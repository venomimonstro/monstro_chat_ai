#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/monstro_chat_ai}"
cd "${INSTALL_DIR}"

IP=$(curl -4 -s --max-time 3 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

set_env() {
  grep -v "^${1}=" .env > .env.tmp 2>/dev/null || true
  echo "${1}=${2}" >> .env.tmp
  mv .env.tmp .env
}

echo "==> Настройка .env..."
set_env NODE_ENV development
set_env COOKIE_SECURE false
set_env SKIP_2FA_ENFORCEMENT true
set_env WEB_CLIENT_URL "http://${IP}:5173"
set_env WEB_ADMIN_URL "http://${IP}:5174"
set_env PUBLIC_SITE_URL "http://${IP}:4321"
set_env API_PUBLIC_URL "http://${IP}:3000/api"

echo "==> Перезапуск API..."
docker compose up -d api
sleep 12

echo "==> Создание пользователей..."
docker compose cp scripts/seed-inline.cjs api:/tmp/seed-inline.cjs
docker compose exec -T api node /tmp/seed-inline.cjs

echo "==> Проверка..."
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"client@demo.local","password":"Test1234!"}' | grep -q email && echo "OK: логин работает"

echo ""
echo "Готово! Логины:"
echo "  client@demo.local / Test1234!"
echo "  admin@chat24ai.local / Test1234!"
