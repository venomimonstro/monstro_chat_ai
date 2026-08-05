#!/usr/bin/env bash
# Настройка 2FA для админа через API (если образ API старый, без SKIP_2FA)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/resolve-install-dir.sh
source "${SCRIPT_DIR}/lib/resolve-install-dir.sh"
cd "${INSTALL_DIR}"
JAR=$(mktemp)

cleanup() { rm -f "$JAR"; }
trap cleanup EXIT

log() { echo -e "\033[1;32m==>\033[0m $*"; }

log "Логин admin@chat24ai.local..."
curl -s -c "$JAR" -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@chat24ai.local","password":"Test1234!"}' >/dev/null

CSRF=$(grep 'aicw_csrf' "$JAR" | awk '{print $7}')
if [[ -z "$CSRF" ]]; then
  echo "ERROR: нет CSRF cookie — проверьте NODE_ENV=development в .env и перезапустите API"
  exit 1
fi

log "Настройка 2FA..."
SETUP=$(curl -s -b "$JAR" -c "$JAR" -X POST http://localhost:3000/api/auth/2fa/setup \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF")

SECRET=$(echo "$SETUP" | sed -n 's/.*"secret":"\([^"]*\)".*/\1/p')
if [[ -z "$SECRET" ]]; then
  echo "ERROR: не получен secret. Ответ: $SETUP"
  exit 1
fi

log "Генерация кода..."
CODE=$(docker compose exec -T api node -e "
const { generate } = require('otplib');
console.log(generate({ secret: '${SECRET}' }));
")

curl -s -b "$JAR" -c "$JAR" -X POST http://localhost:3000/api/auth/2fa/enable \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF" \
  -d "{\"code\":\"${CODE}\"}" >/dev/null

echo ""
echo "OK: 2FA настроена для admin@chat24ai.local"
echo "Теперь войдите в админку: admin@chat24ai.local / Test1234!"
