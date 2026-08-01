#!/usr/bin/env bash
# Создать тестовые аккаунты в БД
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/monstro_chat_ai}"
cd "${INSTALL_DIR}"

echo "==> Создаю тестовые аккаунты..."

if docker compose run --rm api test -f prisma/dist/seed.js; then
  docker compose run --rm api node prisma/dist/seed.js
elif docker compose run --rm api test -f prisma/seed.ts; then
  docker compose run --rm api npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
else
  echo "ERROR: seed не найден — пересоберите API: docker compose build api"
  exit 1
fi

echo ""
echo "=============================================="
echo "  Тестовые аккаунты"
echo "=============================================="
echo "  Админка:  admin@chat24ai.local / Test1234!"
echo "  Клиент:   client@demo.local / Test1234!"
echo ""
echo "  Админ при первом входе настроит 2FA (Google Authenticator)."
echo "=============================================="
