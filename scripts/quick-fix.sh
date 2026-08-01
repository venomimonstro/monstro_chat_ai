#!/usr/bin/env bash
# Быстрый фикс: админ + публичный сайт
set -euo pipefail

cd "${INSTALL_DIR:-/opt/monstro_chat_ai}"

IP=$(curl -4 -s --max-time 3 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

set_env() {
  grep -v "^${1}=" .env > .env.tmp 2>/dev/null || true
  echo "${1}=${2}" >> .env.tmp
  mv .env.tmp .env
}

echo "==> 1. Настройка .env"
set_env NODE_ENV development
set_env COOKIE_SECURE false
set_env SKIP_2FA_ENFORCEMENT true
set_env WEB_CLIENT_URL "http://${IP}:5173"
set_env WEB_ADMIN_URL "http://${IP}:5174"
set_env PUBLIC_SITE_URL "http://${IP}:4321"
set_env API_PUBLIC_URL "http://${IP}:3000/api"

echo "==> 2. Пересборка API (фикс CSRF/login)..."
docker compose build api
docker compose up -d api
sleep 15

echo "==> 3. Создание вашего админа..."
ADMIN_EMAIL="${ADMIN_EMAIL:-lisencko.art@yandex.ru}" \
ADMIN_PASSWORD="${ADMIN_PASSWORD:-UnkinDa140390}" \
bash scripts/create-admin.sh

echo "==> 4. Фронтенд..."
bash scripts/start-frontend.sh

echo "==> 5. Публичный сайт..."
bash scripts/start-public-site.sh

echo ""
echo "=============================================="
echo "  ГОТОВО"
echo "=============================================="
echo "  Публичный сайт: http://${IP}:4321"
echo "  Кабинет:        http://${IP}:5173"
echo "  Админка:        http://${IP}:5174"
echo ""
echo "  Админ: lisencko.art@yandex.ru / UnkinDa140390"
echo "=============================================="
