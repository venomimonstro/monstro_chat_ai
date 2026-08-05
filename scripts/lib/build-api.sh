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

ensure_space_for_build() {
  # Локальная сборка жрёт buildx-кэш — чистим ДО docker compose build
  if [[ -f "${INSTALL_DIR}/scripts/free-disk.sh" ]]; then
    deploy_log "Проверка места на диске перед сборкой API..."
    MIN_FREE_GB="${MIN_FREE_GB:-5}" FORCE_DOCKER_PRUNE=1 \
      bash "${INSTALL_DIR}/scripts/free-disk.sh" \
      || deploy_fail "Нет места на диске. Освободите: sudo bash scripts/free-disk.sh"
  else
    deploy_warn "Чищу Docker builder cache..."
    docker builder prune -af 2>/dev/null || true
    docker image prune -af 2>/dev/null || true
  fi

  local avail
  avail="$(df -BG / | awk 'NR==2 {gsub(/G/,"",$4); print int($4)}')"
  if [[ "${avail:-0}" -lt 3 ]]; then
    deploy_fail "Свободно < 3 GB (${avail}G). Увеличьте диск или: sudo bash scripts/free-disk.sh"
  fi
}

rebuild_local() {
  ensure_space_for_build
  deploy_log "Локальная сборка API (Docker BuildKit cache)..."
  # Сбрасываем «битый» buildx activity при no space left
  rm -f /root/.docker/buildx/activity/.tmp-* 2>/dev/null || true
  docker compose build api
}

up_api() {
  deploy_log "Перезапуск API (migrate + api)..."
  # force-recreate иногда падает с «No such container» на одноразовом aicw-migrate
  docker rm -f aicw-api aicw-migrate 2>/dev/null || true

  local attempt=1
  while [[ "${attempt}" -le 3 ]]; do
    if [[ -n "${API_IMAGE:-}" ]]; then
      if docker compose up -d --no-build --remove-orphans api; then
        return 0
      fi
    elif docker compose up -d --remove-orphans api; then
      return 0
    fi
    deploy_warn "docker compose up api — попытка ${attempt}/3 не удалась, повтор..."
    docker rm -f aicw-api aicw-migrate 2>/dev/null || true
    sleep 2
    attempt=$((attempt + 1))
  done
  deploy_fail "docker compose up api не удался после 3 попыток"
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
