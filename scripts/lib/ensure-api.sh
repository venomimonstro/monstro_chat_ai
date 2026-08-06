#!/usr/bin/env bash
# Поднять Docker API + postgres + redis + minio
set -euo pipefail

ensure_api_stack() {
  local install_dir="${1:?INSTALL_DIR}"
  log() { echo -e "\033[1;32m[api]\033[0m $*"; }
  warn() { echo -e "\033[1;33m[api]\033[0m $*"; }
  fail() { echo -e "\033[1;31m[api]\033[0m $*" >&2; exit 1; }

  cd "${install_dir}"

  if ! command -v docker >/dev/null 2>&1; then
    fail "Docker не установлен"
  fi

  if curl -sf --max-time 5 "http://127.0.0.1:3000/api/health" >/dev/null 2>&1; then
    log "API уже работает"
    return 0
  fi

  log "Запуск postgres, redis, minio..."
  docker compose up -d postgres redis minio 2>&1 | tail -5 || true

  local i
  for i in $(seq 1 20); do
    if docker compose exec -T postgres pg_isready -U aicw -d aicw >/dev/null 2>&1; then
      break
    fi
    sleep 2
  done

  log "Сборка/запуск API..."
  if [[ -f "${install_dir}/scripts/lib/build-api.sh" ]]; then
    bash "${install_dir}/scripts/lib/build-api.sh" || {
      warn "build-api.sh не удался — пробую docker compose up..."
      docker compose up -d --remove-orphans api || true
    }
  else
    docker compose up -d --remove-orphans api || true
  fi

  for i in $(seq 1 30); do
    if curl -sf --max-time 5 "http://127.0.0.1:3000/api/health" >/dev/null 2>&1; then
      log "API OK"
      return 0
    fi
    sleep 2
  done

  warn "API не поднялся. Логи:"
  docker compose logs api --tail 30 2>/dev/null || true
  fail "Запустите вручную: cd ${install_dir} && docker compose up -d api && docker compose logs api"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  # shellcheck source=resolve-install-dir.sh
  source "${SCRIPT_DIR}/resolve-install-dir.sh"
  ensure_api_stack "${INSTALL_DIR}"
fi
