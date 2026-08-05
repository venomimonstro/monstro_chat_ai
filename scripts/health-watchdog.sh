#!/usr/bin/env bash
# Host-side watchdog: проверяет все сервисы и перезапускает упавшие
# Usage: sudo bash scripts/health-watchdog.sh
# Cron: */2 * * * * root /opt/monstro_chat_ai/scripts/health-watchdog.sh >> /var/log/aicw-watchdog.log 2>&1
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/resolve-install-dir.sh
source "${SCRIPT_DIR}/lib/resolve-install-dir.sh"
API_BASE="${API_BASE:-http://127.0.0.1:3000/api}"
CLIENT_PORT="${CLIENT_PORT:-5173}"
ADMIN_PORT="${ADMIN_PORT:-5174}"
PUBLIC_PORT="${PUBLIC_PORT:-4321}"
WIDGET_PORT="${WIDGET_PORT:-5175}"

log() { echo "[$(date -Iseconds)] $*"; }

load_token() {
  if [[ -z "${RELEASE_DEPLOY_TOKEN:-}" && -f "${INSTALL_DIR}/.env" ]]; then
    RELEASE_DEPLOY_TOKEN=$(grep -E '^RELEASE_DEPLOY_TOKEN=' "${INSTALL_DIR}/.env" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
    export RELEASE_DEPLOY_TOKEN
  fi
}

check_url() {
  local name="$1"
  local url="$2"
  local pattern="${3:-}"
  if curl -sf --max-time 8 "${url}" | { if [[ -n "${pattern}" ]]; then grep -qE "${pattern}"; else cat >/dev/null; fi; }; then
    log "OK ${name}"
    return 0
  fi
  log "FAIL ${name} (${url})"
  return 1
}

restart_service() {
  local unit="$1"
  log "Restarting ${unit}..."
  systemctl restart "${unit}" 2>/dev/null || true
  sleep 5
}

restart_api() {
  log "Restarting API container..."
  cd "${INSTALL_DIR}"
  docker compose up -d --force-recreate api 2>/dev/null || docker-compose up -d --force-recreate api 2>/dev/null || true
  sleep 15
}

trigger_api_check() {
  load_token
  if [[ -n "${RELEASE_DEPLOY_TOKEN:-}" ]]; then
    curl -sf -X POST "${API_BASE}/admin/stability/check" \
      -H "Authorization: Bearer invalid" \
      >/dev/null 2>&1 || true
  fi
}

main() {
  local failed=0

  check_url "API" "${API_BASE}/health" '"status":"ok"' || { restart_api; failed=1; }
  check_url "API DB" "${API_BASE}/health/db" '"database":"connected"' || failed=1
  check_url "API Redis" "${API_BASE}/health/redis" '"redis":"connected"' || failed=1
  check_url "Public chat" "${API_BASE}/public/demo-widget" 'demoWidgetKey' || failed=1
  check_url "Web client" "http://127.0.0.1:${CLIENT_PORT}/health.txt" '^ok' || {
    restart_service monstro-web-client
    failed=1
  }
  check_url "Web admin" "http://127.0.0.1:${ADMIN_PORT}/health.txt" '^ok' || {
    restart_service monstro-web-admin
    failed=1
  }
  check_url "Public site" "http://127.0.0.1:${PUBLIC_PORT}/" || {
    restart_service monstro-public-site
    failed=1
  }
  check_url "AI widget" "http://127.0.0.1:${WIDGET_PORT}/health.txt" '^ok' || {
    restart_service monstro-widget
    failed=1
  }

  if [[ "${failed}" -eq 1 ]]; then
    log "Watchdog detected issues — remediation attempted"
  else
    log "All checks passed"
  fi
}

main "$@"
