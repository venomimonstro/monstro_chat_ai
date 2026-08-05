#!/usr/bin/env bash
# Общие функции для fast-update / remote-update
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/redflow}"
if [[ ! -d "${INSTALL_DIR}" && -d /opt/monstro_chat_ai ]]; then
  INSTALL_DIR=/opt/monstro_chat_ai
fi
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

deploy_after_git_pull() {
  if ! deploy_npm_deps_healthy; then
    rm -rf "${LOCK_STAMP_DIR}" 2>/dev/null || true
    deploy_warn "node_modules отсутствуют или повреждены после git pull — будет выполнен npm install"
  fi
}

deploy_stop_npm_consumers() {
  local unit
  for unit in monstro-widget monstro-web-client monstro-web-admin monstro-public-site; do
    if systemctl is-active --quiet "${unit}" 2>/dev/null; then
      deploy_log "Останавливаю ${unit} (освобождаю node_modules/esbuild)..."
      systemctl stop "${unit}" || true
    fi
  done
  pkill -f "${INSTALL_DIR}/node_modules/esbuild" 2>/dev/null || true
  pkill -f "${INSTALL_DIR}/apps/widget.*vite" 2>/dev/null || true
  sleep 1
}

deploy_rm_node_modules() {
  deploy_stop_npm_consumers
  deploy_log "Удаляю node_modules..."
  local paths=(
    "${INSTALL_DIR}/node_modules"
    "${INSTALL_DIR}/apps/api/node_modules"
    "${INSTALL_DIR}/apps/web-client/node_modules"
    "${INSTALL_DIR}/apps/web-admin/node_modules"
    "${INSTALL_DIR}/apps/public-site/node_modules"
    "${INSTALL_DIR}/apps/widget/node_modules"
    "${INSTALL_DIR}/packages/shared-types/node_modules"
  )
  local p
  for p in "${paths[@]}"; do
    [[ -d "${p}" ]] || continue
    chmod -R u+w "${p}" 2>/dev/null || true
    rm -rf "${p}" 2>/dev/null || find "${p}" -mindepth 1 -delete 2>/dev/null || true
    rm -rf "${p}" 2>/dev/null || true
  done
}

deploy_npm_deps_present() {
  [[ -f "${INSTALL_DIR}/node_modules/typescript/package.json" ]]
}

deploy_npm_deps_healthy() {
  deploy_npm_deps_present \
    && [[ -f "${INSTALL_DIR}/node_modules/esbuild/package.json" ]] \
    && [[ -f "${INSTALL_DIR}/node_modules/.package-lock.json" || -f "${INSTALL_DIR}/package-lock.json" ]]
}

deploy_verify_npm_deps() {
  cd "${INSTALL_DIR}"
  deploy_npm_deps_healthy \
    && node -e "require('esbuild'); require('typescript')" 2>/dev/null
}

deploy_npm_install() {
  local scope="$1"
  shift
  local workspaces=("$@")
  local lock_file="${DEPLOY_STATE_DIR}/npm-install.lock"

  deploy_setup_npm_cache
  mkdir -p "${DEPLOY_STATE_DIR}"

  (
    flock -w 900 9 || deploy_fail "npm install: другой процесс удерживает lock (>15 мин)"

    cd "${INSTALL_DIR}"

    local need_install=0
    if [[ "${NPM_FORCE_CLEAN:-0}" == "1" ]]; then
      need_install=1
    elif deploy_lock_changed "${scope}"; then
      need_install=1
    elif ! deploy_npm_deps_healthy; then
      need_install=1
    fi

    if [[ "${need_install}" -eq 0 ]]; then
      deploy_log "npm install пропущен (${scope}, deps OK, lock не менялся)"
      bash "${INSTALL_DIR}/scripts/lib/npm-fix-bins.sh" "${INSTALL_DIR}"
      exit 0
    fi

    if [[ "${NPM_FORCE_CLEAN:-0}" == "1" ]] || ! deploy_npm_deps_healthy; then
      deploy_warn "Повреждённые node_modules — полная очистка перед установкой (${scope})"
      deploy_rm_node_modules
      npm cache clean --force 2>/dev/null || true
    else
      deploy_log "npm install (${scope})..."
    fi

    local attempt=1
    while [[ "${attempt}" -le 3 ]]; do
      deploy_stop_npm_consumers
      if npm install "${workspaces[@]}" --include-workspace-root --no-audit --no-fund; then
        bash "${INSTALL_DIR}/scripts/lib/npm-fix-bins.sh" "${INSTALL_DIR}"
        if deploy_verify_npm_deps; then
          deploy_log "npm install OK (${scope})"
          exit 0
        fi
        deploy_warn "npm install завершился, но deps не прошли проверку"
      else
        deploy_warn "npm install попытка ${attempt}/3 завершилась с ошибкой"
      fi
      deploy_rm_node_modules
      npm cache clean --force 2>/dev/null || true
      sleep 2
      attempt=$((attempt + 1))
    done

    deploy_fail "npm install не удался после 3 попыток. Лог: ${NPM_CACHE_DIR}/_logs/"
  ) 9>"${lock_file}"
}

deploy_npm_install_for_components() {
  local components="$1"
  local workspaces=()

  if [[ " ${components} " == *" widget "* ]] \
    || [[ " ${components} " == *" frontends "* ]] \
    || [[ " ${components} " == *" site "* ]]; then
    workspaces+=(--workspace=@ai-consultant/shared-types)
  fi
  if [[ " ${components} " == *" widget "* ]]; then
    workspaces+=(--workspace=@ai-consultant/widget)
  fi
  if [[ " ${components} " == *" frontends "* ]]; then
    workspaces+=(--workspace=@ai-consultant/web-client)
    workspaces+=(--workspace=@ai-consultant/web-admin)
  fi
  if [[ " ${components} " == *" site "* ]]; then
    workspaces+=(--workspace=@ai-consultant/public-site)
  fi

  [[ "${#workspaces[@]}" -eq 0 ]] && return 0

  deploy_npm_install "components" "${workspaces[@]}"
  export DEPLOY_SKIP_NPM_INSTALL=1
}

deploy_restart_if_active() {
  local unit="$1"
  if systemctl is-active --quiet "${unit}" 2>/dev/null; then
    systemctl restart "${unit}"
    return 0
  fi
  return 1
}

deploy_load_dotenv() {
  if [[ ! -f "${INSTALL_DIR}/.env" ]]; then
    return 0
  fi
  while IFS= read -r line || [[ -n "${line}" ]]; do
    [[ "${line}" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]] || continue
    [[ "${line}" =~ ^# ]] && continue
    local key="${line%%=*}"
    local val="${line#*=}"
    val="${val%$'\r'}"
    case "${key}" in
      NEXT_PUBLIC_*|PUBLIC_SITE_URL|WEB_*|WIDGET_URL|API_PUBLIC_URL|API_INTERNAL_URL|VITE_*)
        export "${key}=${val}"
        ;;
    esac
  done < "${INSTALL_DIR}/.env"
}

deploy_export_frontend_env() {
  local ip
  ip="$(deploy_detect_ip)"
  deploy_load_dotenv

  export VITE_WIDGET_SCRIPT_URL="${VITE_WIDGET_SCRIPT_URL:-${NEXT_PUBLIC_WIDGET_URL:-http://${ip}:5175}/embed.js}"
  export VITE_WIDGET_URL="${VITE_WIDGET_URL:-${NEXT_PUBLIC_WIDGET_URL:-http://${ip}:5175}}"
  export VITE_API_URL="${VITE_API_URL:-${NEXT_PUBLIC_API_URL:-http://${ip}:3000/api}}"
  export NEXT_PUBLIC_WIDGET_URL="${NEXT_PUBLIC_WIDGET_URL:-http://${ip}:5175}"
  export NEXT_PUBLIC_CLIENT_URL="${NEXT_PUBLIC_CLIENT_URL:-http://${ip}:5173}"
  export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://${ip}:3000/api}"
  export NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-http://${ip}:4321}"
  export API_INTERNAL_URL="${API_INTERNAL_URL:-http://127.0.0.1:3000}"
}

deploy_sync_systemd_units() {
  bash "${INSTALL_DIR}/scripts/lib/sync-systemd-units.sh" "${INSTALL_DIR}"
}
