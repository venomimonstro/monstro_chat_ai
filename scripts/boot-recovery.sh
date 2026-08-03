#!/usr/bin/env bash
# Восстанавливает Docker-стек и host-сервисы Monstro после перезагрузки сервера.
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/monstro_chat_ai}"
API_BASE="${API_BASE:-http://127.0.0.1:3000/api}"

log() { echo "[$(date -Iseconds)] boot-recovery: $*"; }

wait_for_docker() {
  local i
  for i in $(seq 1 30); do
    if docker info >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  log "Docker не отвечает"
  return 1
}

start_compose() {
  [[ -f "${INSTALL_DIR}/docker-compose.yml" ]] || return 0
  cd "${INSTALL_DIR}"
  log "docker compose up -d"
  docker compose up -d postgres redis minio api 2>/dev/null || docker-compose up -d postgres redis minio api 2>/dev/null || true
}

wait_for_api() {
  local i
  for i in $(seq 1 36); do
    if curl -sf --max-time 5 "${API_BASE}/health" >/dev/null 2>&1; then
      log "API OK"
      return 0
    fi
    sleep 5
  done
  log "API не поднялся за 3 мин — watchdog дожмёт"
  return 1
}

start_host_services() {
  local units=(
    monstro-widget
    monstro-web-client
    monstro-web-admin
    monstro-public-site
  )
  for unit in "${units[@]}"; do
    if systemctl list-unit-files "${unit}.service" 2>/dev/null | grep -q "${unit}.service"; then
      if ! systemctl is-active --quiet "${unit}" 2>/dev/null; then
        log "start ${unit}"
        systemctl start "${unit}" 2>/dev/null || true
      fi
    fi
  done
}

main() {
  wait_for_docker || exit 1
  start_compose
  wait_for_api || true
  start_host_services
  log "done"
}

main "$@"
