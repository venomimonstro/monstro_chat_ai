#!/usr/bin/env bash
# Общие функции для fast-update / remote-update
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/monstro_chat_ai}"
DEPLOY_STATE_DIR="${INSTALL_DIR}/.deploy"
DEPLOY_SHA_FILE="${DEPLOY_STATE_DIR}/last-sha"
NPM_CACHE_DIR="${NPM_CACHE_DIR:-/var/cache/aicw/npm}"
LOCK_STAMP_DIR="${DEPLOY_STATE_DIR}/lock-stamps"

deploy_log()  { echo -e "\n\033[1;32m==>\033[0m $*"; }
deploy_warn() { echo -e "\033[1;33m!!\033[0m $*"; }
deploy_fail() { echo -e "\033[1;31mERROR:\033[0m $*" >&2; exit 1; }

deploy_detect_ip() {
  curl -4 -s --max-time 3 ifconfig.me 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}'
}

deploy_setup_npm_cache() {
  mkdir -p "${NPM_CACHE_DIR}" "${DEPLOY_STATE_DIR}" "${LOCK_STAMP_DIR}"
  export NPM_CONFIG_CACHE="${NPM_CACHE_DIR}"
  export npm_config_cache="${NPM_CACHE_DIR}"
}

deploy_save_sha() {
  local sha="$1"
  mkdir -p "${DEPLOY_STATE_DIR}"
  echo "${sha}" > "${DEPLOY_SHA_FILE}"
}

deploy_load_sha() {
  if [[ -f "${DEPLOY_SHA_FILE}" ]]; then
    cat "${DEPLOY_SHA_FILE}"
    return 0
  fi
  return 1
}

# Печатает список компонентов: api widget frontends site
deploy_detect_components() {
  local from_sha="${1:-}"
  local to_sha="${2:-HEAD}"

  if [[ -z "${from_sha}" ]]; then
    from_sha="$(deploy_load_sha 2>/dev/null || true)"
  fi
  if [[ -z "${from_sha}" ]]; then
    from_sha="$(git -C "${INSTALL_DIR}" rev-parse HEAD~1 2>/dev/null || true)"
  fi

  local need_api=0 need_widget=0 need_frontends=0 need_site=0
  local files

  if [[ -z "${from_sha}" ]]; then
    echo "api widget frontends site"
    return 0
  fi

  files="$(git -C "${INSTALL_DIR}" diff --name-only "${from_sha}" "${to_sha}" 2>/dev/null || true)"
  if [[ -z "${files}" ]]; then
    return 0
  fi

  while IFS= read -r path; do
    [[ -z "${path}" ]] && continue
    case "${path}" in
      apps/api/*|docker-compose.yml|apps/api/Dockerfile)
        need_api=1 ;;
      apps/widget/*)
        need_widget=1 ;;
      apps/web-client/*|apps/web-admin/*)
        need_frontends=1 ;;
      apps/public-site/*)
        need_site=1 ;;
      packages/shared-types/*)
        need_widget=1
        need_frontends=1
        need_site=1 ;;
      package.json|package-lock.json|turbo.json)
        need_api=1
        need_widget=1
        need_frontends=1
        need_site=1 ;;
    esac
  done <<< "${files}"

  [[ "${need_api}" -eq 1 ]] && echo -n "api "
  [[ "${need_widget}" -eq 1 ]] && echo -n "widget "
  [[ "${need_frontends}" -eq 1 ]] && echo -n "frontends "
  [[ "${need_site}" -eq 1 ]] && echo -n "site "
  echo ""
}

deploy_lock_changed() {
  local scope="$1"
  local stamp="${LOCK_STAMP_DIR}/${scope}.sha"
  local current
  current="$(sha256sum "${INSTALL_DIR}/package-lock.json" | awk '{print $1}')"
  if [[ -f "${stamp}" ]] && [[ "$(cat "${stamp}")" == "${current}" ]]; then
    return 1
  fi
  echo "${current}" > "${stamp}"
  return 0
}

deploy_npm_install() {
  local scope="$1"
  shift
  local workspaces=("$@")

  deploy_setup_npm_cache
  cd "${INSTALL_DIR}"

  if ! deploy_lock_changed "${scope}"; then
    deploy_log "npm install пропущен (${scope}, package-lock.json не менялся)"
    bash "${INSTALL_DIR}/scripts/lib/npm-fix-bins.sh"
    return 0
  fi

  deploy_log "npm install (${scope})..."
  npm install "${workspaces[@]}" --include-workspace-root
  bash "${INSTALL_DIR}/scripts/lib/npm-fix-bins.sh"
}

deploy_restart_if_active() {
  local unit="$1"
  if systemctl is-active --quiet "${unit}" 2>/dev/null; then
    systemctl restart "${unit}"
    return 0
  fi
  return 1
}

deploy_export_frontend_env() {
  local ip
  ip="$(deploy_detect_ip)"
  export VITE_WIDGET_SCRIPT_URL="http://${ip}:5175/embed.js"
  export VITE_WIDGET_URL="http://${ip}:5175"
  export VITE_API_URL="http://${ip}:3000/api"
  export NEXT_PUBLIC_WIDGET_URL="http://${ip}:5175"
  export NEXT_PUBLIC_CLIENT_URL="http://${ip}:5173"
  export NEXT_PUBLIC_API_URL="http://${ip}:3000/api"
  export NEXT_PUBLIC_SITE_URL="http://${ip}:4321"
  export API_INTERNAL_URL="http://127.0.0.1:3000"
}
