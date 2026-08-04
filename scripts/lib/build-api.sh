#!/usr/bin/env bash
# API: pull готового образа из GHCR (если есть) или локальная сборка с кэшем
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/monstro_chat_ai}"
API_USE_GHCR="${API_USE_GHCR:-1}"
GHCR_IMAGE="${GHCR_IMAGE:-ghcr.io/venomimonstro/monstro_chat_ai/api}"
# shellcheck source=lib/deploy-common.sh
source "${INSTALL_DIR}/scripts/lib/deploy-common.sh"

cd "${INSTALL_DIR}"
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

APP_VERSION="${APP_VERSION:-0.37.0}"
SPRINT_NUMBER="${SPRINT_NUMBER:-37}"
export APP_VERSION SPRINT_NUMBER

try_ghcr_pull() {
  [[ "${API_USE_GHCR}" == "1" ]] || return 1

  local git_sha short_sha image tag
  git_sha="$(git rev-parse HEAD)"
  short_sha="$(git rev-parse --short HEAD)"

  for tag in "sha-${git_sha}" "sha-${short_sha}" "main"; do
    image="${GHCR_IMAGE}:${tag}"
    deploy_log "Пробую pull API образа ${image}..."
    if docker pull "${image}" 2>/dev/null; then
      export API_IMAGE="${image}"
      docker tag "${image}" monstro_chat_ai-api 2>/dev/null || true
      deploy_log "Образ загружен из GHCR (${tag})"
      return 0
    fi
  done
  return 1
}

rebuild_local() {
  deploy_log "Локальная сборка API (Docker BuildKit cache)..."
  docker compose build api
}

up_api() {
  if [[ -n "${API_IMAGE:-}" ]]; then
    docker compose up -d --no-build --force-recreate api
  else
    docker compose up -d --force-recreate api
  fi
}

if try_ghcr_pull; then
  :
else
  deploy_warn "GHCR образ недоступен — собираю локально"
  rebuild_local
fi

up_api

deploy_log "Жду API..."
for i in $(seq 1 24); do
  if curl -sf http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    deploy_log "API OK"
    exit 0
  fi
  sleep 3
done

deploy_fail "API не поднялся после обновления"
