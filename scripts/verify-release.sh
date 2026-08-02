#!/usr/bin/env bash
# Проверка корректности релиза
# Usage:
#   bash scripts/verify-release.sh pre              # перед деплоем (только health/db/redis)
#   bash scripts/verify-release.sh post [ver] [spr] # после деплоем (полная проверка)
#   bash scripts/verify-release.sh [ver] [spr]      # alias для post
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:3000/api}"
MODE="post"
EXPECTED_VERSION=""
EXPECTED_SPRINT=""
ADMIN_PORT="${ADMIN_PORT:-5174}"
PUBLIC_PORT="${PUBLIC_PORT:-4321}"

if [[ "${1:-}" == "pre" ]]; then
  MODE="pre"
elif [[ "${1:-}" == "post" ]]; then
  MODE="post"
  EXPECTED_VERSION="${2:-}"
  EXPECTED_SPRINT="${3:-}"
elif [[ -n "${1:-}" ]]; then
  EXPECTED_VERSION="${1:-}"
  EXPECTED_SPRINT="${2:-}"
fi

log()  { echo -e "\033[1;32m[verify]\033[0m $*"; }
fail() { echo -e "\033[1;31m[verify FAIL]\033[0m $*" >&2; exit 1; }

check_health() {
  log "Health check: ${API_BASE}/health"
  local body
  body=$(curl -sf "${API_BASE}/health" 2>/dev/null) || fail "API health недоступен"
  echo "  ${body}"

  if [[ "${MODE}" == "post" && -n "${EXPECTED_VERSION}" ]]; then
    local ver
    ver=$(echo "${body}" | python3 -c "import sys,json; print(json.load(sys.stdin).get('version',''))" 2>/dev/null || echo "")
    if [[ -n "${ver}" && "${ver}" != "${EXPECTED_VERSION}" ]]; then
      fail "Версия API ${ver} != ожидаемой ${EXPECTED_VERSION}"
    fi
  fi
}

check_db() {
  log "Database: ${API_BASE}/health/db"
  local body
  body=$(curl -sf "${API_BASE}/health/db" 2>/dev/null) || fail "health/db недоступен"
  echo "${body}" | grep -q '"database":"connected"' || fail "База данных не подключена"
  log "  DB OK"
}

check_redis() {
  log "Redis: ${API_BASE}/health/redis"
  local body
  body=$(curl -sf "${API_BASE}/health/redis" 2>/dev/null) || fail "health/redis недоступен"
  echo "${body}" | grep -q '"redis":"connected"' || fail "Redis не подключён"
  log "  Redis OK"
}

check_sprint32_api() {
  log "Sprint 32+ API: ${API_BASE}/public/demo-widget"
  local body
  body=$(curl -sf "${API_BASE}/public/demo-widget" 2>/dev/null) || fail "demo-widget недоступен"
  echo "${body}" | grep -q 'demoWidgetKey' || fail "API устарел (нет поля demoWidgetKey)"
  log "  demo-widget OK"
}

check_release_endpoint() {
  log "Release info: ${API_BASE}/public/release"
  local body
  body=$(curl -sf "${API_BASE}/public/release" 2>/dev/null) || fail "public/release недоступен"
  echo "  ${body}"
  if [[ -n "${EXPECTED_SPRINT}" ]]; then
    echo "${body}" | grep -q "\"sprint\":${EXPECTED_SPRINT}" || \
      echo "${body}" | grep -q "\"sprint\": ${EXPECTED_SPRINT}" || \
      fail "Спринт в API не совпадает с ожидаемым ${EXPECTED_SPRINT}"
  fi
}

check_frontend() {
  log "Админка: http://127.0.0.1:${ADMIN_PORT}/"
  curl -sf -o /dev/null "http://127.0.0.1:${ADMIN_PORT}/" || warn_admin=1
  if [[ "${warn_admin:-0}" -eq 1 ]]; then
    echo "  WARN: админка не отвечает на :${ADMIN_PORT}"
  else
    log "  Админка OK"
  fi

  log "Публичный сайт: http://127.0.0.1:${PUBLIC_PORT}/"
  curl -sf -o /dev/null "http://127.0.0.1:${PUBLIC_PORT}/" || warn_public=1
  if [[ "${warn_public:-0}" -eq 1 ]]; then
    echo "  WARN: публичный сайт не отвечает на :${PUBLIC_PORT}"
  else
    log "  Публичный сайт OK"
  fi
}

main() {
  log "Запуск проверки (${MODE})"
  check_health
  check_db
  check_redis

  if [[ "${MODE}" == "pre" ]]; then
    log "Pre-deploy OK (базовая доступность)"
    return 0
  fi

  check_sprint32_api
  check_release_endpoint
  check_frontend
  log "Все критические проверки пройдены"
}

main "$@"
