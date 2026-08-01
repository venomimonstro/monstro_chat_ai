#!/usr/bin/env bash
# Диагностика — что не работает
set -euo pipefail

cd "${INSTALL_DIR:-/opt/monstro_chat_ai}"

echo "=== Диск ==="
df -h /

echo ""
echo "=== Docker ==="
docker compose ps 2>/dev/null || true

echo ""
echo "=== API health ==="
curl -s http://localhost:3000/api/health 2>/dev/null || echo "API не отвечает"

echo ""
echo "=== Пользователи в БД ==="
docker compose exec -T postgres psql -U aicw -d aicw -c 'SELECT email, role, status FROM "User";' 2>/dev/null || echo "БД недоступна"

echo ""
echo "=== Тест логина клиента ==="
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"client@demo.local","password":"Test1234!"}' | head -c 300
echo ""

echo ""
echo "=== Фронтенд ==="
systemctl is-active monstro-web-client 2>/dev/null || echo "web-client: не запущен"
systemctl is-active monstro-web-admin 2>/dev/null || echo "web-admin: не запущен"
systemctl is-active monstro-public-site 2>/dev/null || echo "public-site: не запущен"

echo ""
echo "=== Порты ==="
curl -s -o /dev/null -w "5173: %{http_code}\n" http://localhost:5173/ 2>/dev/null || echo "5173: нет"
curl -s -o /dev/null -w "5174: %{http_code}\n" http://localhost:5174/ 2>/dev/null || echo "5174: нет"
curl -s -o /dev/null -w "4321: %{http_code}\n" http://localhost:4321/ 2>/dev/null || echo "4321: нет"

echo ""
echo "=== .env (ключевые) ==="
grep -E '^(NODE_ENV|COOKIE_SECURE|SKIP_2FA|WEB_)' .env 2>/dev/null || true
