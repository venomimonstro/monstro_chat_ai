#!/usr/bin/env bash
# Создать тестовые аккаунты в БД
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/monstro_chat_ai}"
cd "${INSTALL_DIR}"

echo "==> Создаю тестовые аккаунты..."

if docker compose exec -T api test -f prisma/seed-inline.cjs 2>/dev/null; then
  docker compose exec -T api node prisma/seed-inline.cjs
elif docker compose exec -T api test -f prisma/dist/seed.js 2>/dev/null; then
  docker compose exec -T api node prisma/dist/seed.js
elif docker compose exec -T api test -f prisma/seed.ts 2>/dev/null; then
  docker compose exec -T api npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
else
  docker compose cp scripts/seed-inline.cjs api:/app/prisma/seed-inline.cjs
  docker compose exec -T api node prisma/seed-inline.cjs
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
