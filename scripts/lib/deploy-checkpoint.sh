#!/usr/bin/env bash
# Checkpoint / rollback: при сбое деплоя восстанавливаем последнюю рабочую версию артефактов.
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/monstro_chat_ai}"
DEPLOY_STATE_DIR="${INSTALL_DIR}/.deploy"
CHECKPOINT_DIR="${DEPLOY_STATE_DIR}/checkpoint"
CHECKPOINT_PRE="${CHECKPOINT_DIR}/pre"
CHECKPOINT_META="${CHECKPOINT_DIR}/meta.env"
LAST_GOOD_DIR="${DEPLOY_STATE_DIR}/last-good"
API_ROLLBACK_TAG="monstro_chat_ai-api:deploy-pre"

# shellcheck source=lib/deploy-common.sh
source "${INSTALL_DIR}/scripts/lib/deploy-common.sh" 2>/dev/null || true

_deploy_checkpoint_dist_apps() {
  echo "widget web-client web-admin"
}

_deploy_checkpoint_has_pre() {
  [[ -f "${CHECKPOINT_META}" ]]
}

_deploy_checkpoint_rsync_dir() {
  local src="$1"
  local dest="$2"
  [[ -d "${src}" ]] || return 0
  mkdir -p "$(dirname "${dest}")"
  rm -rf "${dest}"
  rsync -a --delete "${src}/" "${dest}/"
}

_deploy_checkpoint_backup_dist() {
  local app="$1"
  local dest_root="$2"
  local src="${INSTALL_DIR}/apps/${app}/dist"
  if [[ -d "${src}" ]]; then
    _deploy_checkpoint_rsync_dir "${src}" "${dest_root}/dist/${app}"
  fi
}

_deploy_checkpoint_backup_next() {
  local dest_root="$1"
  local src="${INSTALL_DIR}/apps/public-site/.next"
  if [[ -d "${src}" ]]; then
    _deploy_checkpoint_rsync_dir "${src}" "${dest_root}/public-site/.next"
  fi
}

_deploy_checkpoint_backup_api_image() {
  local dest_root="$1"
  mkdir -p "${dest_root}"
  if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -qx 'aicw-api'; then
    local img_id
    img_id="$(docker inspect -f '{{.Image}}' aicw-api 2>/dev/null || true)"
    if [[ -n "${img_id}" ]]; then
      echo "${img_id}" > "${dest_root}/api-image.id"
      docker tag "${img_id}" "${API_ROLLBACK_TAG}" 2>/dev/null || true
    fi
  fi
}

_deploy_checkpoint_save_manifest() {
  local dest="$1"
  if [[ -f "${INSTALL_DIR}/releases/manifest.json" ]]; then
    cp -a "${INSTALL_DIR}/releases/manifest.json" "${dest}/manifest.json"
  fi
}

# Снимок текущего рабочего состояния ДО pull/build (для отката при сбое).
deploy_checkpoint_begin() {
  local components="${1:-}"
  mkdir -p "${CHECKPOINT_PRE}"
  rm -rf "${CHECKPOINT_PRE:?}"/*
  touch "${CHECKPOINT_DIR}/active"

  local git_sha
  git_sha="$(git -C "${INSTALL_DIR}" rev-parse HEAD 2>/dev/null || true)"
  local deploy_sha
  deploy_sha="$(deploy_load_sha 2>/dev/null || echo "${git_sha}")"

  cat > "${CHECKPOINT_META}" <<EOF
GIT_SHA=${git_sha}
DEPLOY_SHA=${deploy_sha}
COMPONENTS=${components}
CREATED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF
  cp -a "${CHECKPOINT_META}" "${CHECKPOINT_PRE}/meta.env"

  _deploy_checkpoint_save_manifest "${CHECKPOINT_PRE}"
  _deploy_checkpoint_backup_api_image "${CHECKPOINT_PRE}"

  local app
  for app in $(_deploy_checkpoint_dist_apps); do
    _deploy_checkpoint_backup_dist "${app}" "${CHECKPOINT_PRE}"
  done
  _deploy_checkpoint_backup_next "${CHECKPOINT_PRE}"

  deploy_log "Checkpoint: сохранено рабочее состояние (${deploy_sha:0:8})"
}

deploy_checkpoint_promote() {
  if ! _deploy_checkpoint_has_pre; then
    return 0
  fi

  mkdir -p "${LAST_GOOD_DIR}"
  rm -rf "${LAST_GOOD_DIR:?}"/*
  cp -a "${CHECKPOINT_PRE}/." "${LAST_GOOD_DIR}/" 2>/dev/null || true
  if [[ -f "${CHECKPOINT_META}" ]]; then
    cp -a "${CHECKPOINT_META}" "${LAST_GOOD_DIR}/meta.env"
  fi

  # Обновляем meta на фактически задеплоенный коммит
  local new_sha
  new_sha="$(git -C "${INSTALL_DIR}" rev-parse HEAD 2>/dev/null || true)"
  if [[ -n "${new_sha}" ]]; then
    cat > "${LAST_GOOD_DIR}/meta.env" <<EOF
GIT_SHA=${new_sha}
DEPLOY_SHA=${new_sha}
PROMOTED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF
  fi

  deploy_checkpoint_clear
  deploy_log "Checkpoint: рабочая версия зафиксирована (last-good)"
}

deploy_checkpoint_clear() {
  rm -f "${CHECKPOINT_DIR}/active"
  rm -f "${CHECKPOINT_META}"
  rm -rf "${CHECKPOINT_PRE}" 2>/dev/null || true
}

_restore_dist_from_root() {
  local root="$1"
  local app="$2"
  local backup="${root}/dist/${app}"
  local target="${INSTALL_DIR}/apps/${app}/dist"
  if [[ -d "${backup}" ]]; then
    _deploy_checkpoint_rsync_dir "${backup}" "${target}"
    deploy_log "Восстановлен dist: ${app}"
  fi
}

_restore_next_from_root() {
  local root="$1"
  local backup="${root}/public-site/.next"
  local target="${INSTALL_DIR}/apps/public-site/.next"
  if [[ -d "${backup}" ]]; then
    _deploy_checkpoint_rsync_dir "${backup}" "${target}"
    deploy_log "Восстановлен .next: public-site"
  fi
}

_restore_api_from_root() {
  local root="$1"
  if [[ -f "${root}/api-image.id" ]]; then
    local img_id
    img_id="$(cat "${root}/api-image.id")"
    if docker image inspect "${img_id}" >/dev/null 2>&1; then
      docker tag "${img_id}" monstro_chat_ai-api 2>/dev/null || true
      export API_IMAGE="monstro_chat_ai-api"
      deploy_log "Восстановлен образ API (pre-deploy)"
      docker rm -f aicw-migrate 2>/dev/null || true
      if (cd "${INSTALL_DIR}" && docker compose up -d --no-build --remove-orphans api); then
        local i
        for i in $(seq 1 18); do
          if curl -sf http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
            deploy_log "API восстановлен и отвечает"
            return 0
          fi
          sleep 2
        done
        deploy_warn "API поднят, но health ещё не OK"
      fi
    fi
  fi

  if docker image inspect "${API_ROLLBACK_TAG}" >/dev/null 2>&1; then
    docker tag "${API_ROLLBACK_TAG}" monstro_chat_ai-api 2>/dev/null || true
    export API_IMAGE="monstro_chat_ai-api"
    docker rm -f aicw-migrate 2>/dev/null || true
    (cd "${INSTALL_DIR}" && docker compose up -d --no-build --remove-orphans api) || true
    deploy_log "API восстановлен из тега ${API_ROLLBACK_TAG}"
  fi
}

_restore_git_from_meta() {
  local meta="$1"
  [[ -f "${meta}" ]] || return 0
  # shellcheck disable=SC1090
  source "${meta}"
  local target_sha="${DEPLOY_SHA:-${GIT_SHA:-}}"
  [[ -n "${target_sha}" ]] || return 0

  deploy_log "Git reset → ${target_sha:0:8}"
  git -C "${INSTALL_DIR}" fetch origin 2>/dev/null || true
  git -C "${INSTALL_DIR}" checkout "${BRANCH:-main}" 2>/dev/null || true
  git -C "${INSTALL_DIR}" reset --hard "${target_sha}" 2>/dev/null || \
    git -C "${INSTALL_DIR}" reset --hard "origin/${BRANCH:-main}" 2>/dev/null || true
}

_restore_manifest_from_root() {
  local root="$1"
  if [[ -f "${root}/manifest.json" ]]; then
    mkdir -p "${INSTALL_DIR}/releases"
    cp -a "${root}/manifest.json" "${INSTALL_DIR}/releases/manifest.json"
    deploy_log "Восстановлен releases/manifest.json"
  fi
}

# Откат к снимку pre-deploy (или last-good если pre отсутствует).
deploy_checkpoint_rollback_to() {
  local root="$1"
  local reason="${2:-сбой деплоя}"

  if ! [[ -d "${root}" ]] || [[ -z "$(ls -A "${root}" 2>/dev/null || true)" ]]; then
    deploy_warn "Checkpoint пуст (${root}) — откат артефактов невозможен"
    deploy_restore_node_services || true
    return 1
  fi

  deploy_warn "Откат checkpoint: ${reason}"

  if [[ -f "${CHECKPOINT_META}" ]]; then
    _restore_git_from_meta "${CHECKPOINT_META}"
  elif [[ -f "${root}/meta.env" ]]; then
    _restore_git_from_meta "${root}/meta.env"
  fi

  local app
  for app in $(_deploy_checkpoint_dist_apps); do
    _restore_dist_from_root "${root}" "${app}"
  done
  _restore_next_from_root "${root}"
  _restore_manifest_from_root "${root}"
  _restore_api_from_root "${root}"

  deploy_restore_node_services || true
  sleep 2
  deploy_verify_frontends || deploy_warn "Фронты после отката требуют проверки: recover-frontends.sh"

  if [[ -f "${root}/meta.env" ]]; then
    # shellcheck disable=SC1090
    source "${root}/meta.env"
    if [[ -n "${DEPLOY_SHA:-}" ]]; then
      deploy_save_sha "${DEPLOY_SHA}"
    fi
  fi

  deploy_checkpoint_clear
  deploy_log "Откат завершён — сервисы на предыдущей рабочей версии"
  return 0
}

deploy_checkpoint_rollback() {
  local reason="${1:-сбой деплоя}"
  local root="${CHECKPOINT_PRE}"

  if ! [[ -d "${root}" ]] || [[ -z "$(ls -A "${root}" 2>/dev/null || true)" ]]; then
    root="${LAST_GOOD_DIR}"
    if ! [[ -d "${root}" ]] || [[ -z "$(ls -A "${root}" 2>/dev/null || true)" ]]; then
      deploy_warn "Checkpoint пуст — откат артефактов невозможен"
      deploy_restore_node_services || true
      return 1
    fi
    deploy_warn "Откат из last-good (pre-checkpoint недоступен)"
  fi

  deploy_checkpoint_rollback_to "${root}" "${reason}"
}

# Ручное восстановление из last-good (recover-last-good.sh / ops).
deploy_restore_last_good() {
  if ! [[ -d "${LAST_GOOD_DIR}" ]] || [[ -z "$(ls -A "${LAST_GOOD_DIR}" 2>/dev/null || true)" ]]; then
    deploy_fail "last-good не найден — успешный деплой ещё не фиксировался"
  fi
  deploy_checkpoint_rollback_to "${LAST_GOOD_DIR}" "ручное восстановление last-good"
}
