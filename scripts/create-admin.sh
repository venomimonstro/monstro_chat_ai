#!/usr/bin/env bash
# Создать админа платформы (owner)
# Использование: ADMIN_EMAIL=you@mail.ru ADMIN_PASSWORD=secret bash scripts/create-admin.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/resolve-install-dir.sh
source "${SCRIPT_DIR}/lib/resolve-install-dir.sh"
cd "${INSTALL_DIR}"

EMAIL="${ADMIN_EMAIL:?Укажите ADMIN_EMAIL=your@email.ru}"
PASSWORD="${ADMIN_PASSWORD:?Укажите ADMIN_PASSWORD=yourpassword}"

echo "==> Создаю админа: ${EMAIL}"

docker compose cp scripts/create-admin-inline.cjs api:/app/prisma/create-admin-inline.cjs

docker compose exec -T \
  -e ADMIN_EMAIL="$EMAIL" \
  -e ADMIN_PASSWORD="$PASSWORD" \
  api node prisma/create-admin-inline.cjs

echo ""
echo "=============================================="
echo "  Админ создан"
echo "=============================================="
echo "  URL:    http://$(curl -4 -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}'):5174"
echo "  Email:  ${EMAIL}"
echo "  Пароль: (тот что вы указали)"
echo "=============================================="
