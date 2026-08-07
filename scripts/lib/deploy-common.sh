#!/usr/bin/env bash
# Общие функции для fast-update / remote-update
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/monstro_chat_ai}"
DEPLOY_STATE_DIR="${INSTALL_DIR}/.deploy"
DEPLOY_SHA_FILE="${DEPLOY_STATE_DIR}/last-sha"
NPM_CACHE_DIR="${NPM_CACHE_DIR:-/var/cache/aicw/npm}"
LOCK_STAMP_DIR="${DEPLOY_STATE_DIR}/lock-stamps"
STOPPED_UNITS_FILE="${DEPLOY_STATE_DIR}/stopped-units.txt"

FRONTEND_UNITS=(monstro-widget monstro-web-client monstro-web-admin monstro-public-site)

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
      # Деплой/сборка трогает фронты — всегда пересоберём и поднимем сервисы
      scripts/*|package.json|package-lock.json|turbo.json)
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

# true (0) если stamp отличается ИЛИ stamp отсутствует — нужен install.
# НЕ пишет stamp (stamp пишется только после успешного install).
deploy_lock_needs_install() {
  local scope="$1"
  local stamp="${LOCK_STAMP_DIR}/${scope}.sha"
  local current
  current="$(sha256sum "${INSTALL_DIR}/package-lock.json" | awk '{print $1}')"
  if [[ -f "${stamp}" ]] && [[ "$(cat "${stamp}")" == "${current}" ]]; then
    return 1
  fi
  return 0
}

deploy_lock_mark_ok() {
  local scope="$1"
  local stamp="${LOCK_STAMP_DIR}/${scope}.sha"
  mkdir -p "${LOCK_STAMP_DIR}"
  sha256sum "${INSTALL_DIR}/package-lock.json" | awk '{print $1}' > "${stamp}"
}

deploy_npm_acquire_lock() {
  local lockfile="${DEPLOY_STATE_DIR}/npm-install.lock"
  mkdir -p "${DEPLOY_STATE_DIR}"
  exec {DEPLOY_NPM_LOCK_FD}>"${lockfile}"
  if ! flock -w 900 "${DEPLOY_NPM_LOCK_FD}"; then
    deploy_fail "Не удалось получить lock npm install (15 мин)"
  fi
}

deploy_npm_release_lock() {
  if [[ -n "${DEPLOY_NPM_LOCK_FD:-}" ]]; then
    flock -u "${DEPLOY_NPM_LOCK_FD}" 2>/dev/null || true
    exec {DEPLOY_NPM_LOCK_FD}>&-
    unset DEPLOY_NPM_LOCK_FD
  fi
}

deploy_unit_exists() {
  local unit="$1"
  [[ -f "/etc/systemd/system/${unit}.service" ]] \
    || systemctl cat "${unit}.service" >/dev/null 2>&1
}

# Запоминаем остановленные unit'ы, чтобы поднять после npm/сборки (иначе 502).
deploy_remember_stopped() {
  local unit="$1"
  mkdir -p "${DEPLOY_STATE_DIR}"
  touch "${STOPPED_UNITS_FILE}"
  if ! grep -qx "${unit}" "${STOPPED_UNITS_FILE}" 2>/dev/null; then
    echo "${unit}" >> "${STOPPED_UNITS_FILE}"
  fi
}

deploy_stop_node_services() {
  local unit
  mkdir -p "${DEPLOY_STATE_DIR}"
  : > "${STOPPED_UNITS_FILE}"
  for unit in "${FRONTEND_UNITS[@]}"; do
    if systemctl is-active --quiet "${unit}" 2>/dev/null; then
      deploy_log "Остановка ${unit} (npm/esbuild не должен держать файлы)..."
      deploy_remember_stopped "${unit}"
      systemctl stop "${unit}" || true
    elif deploy_unit_exists "${unit}"; then
      # Уже down — всё равно нужно поднять после деплоя
      deploy_remember_stopped "${unit}"
    fi
  done
  sleep 2
}

deploy_remove_node_modules() {
  deploy_stop_node_services
  cd "${INSTALL_DIR}"
  deploy_log "Удаление повреждённого node_modules..."
  rm -rf node_modules
  find "${INSTALL_DIR}/apps" "${INSTALL_DIR}/packages" -name node_modules -type d -prune -exec rm -rf {} + 2>/dev/null || true
}

deploy_npm_deps_healthy() {
  local tsc_lib="${INSTALL_DIR}/node_modules/typescript/lib/tsc.js"
  local esbuild_bin="${INSTALL_DIR}/node_modules/esbuild/bin/esbuild"
  if [[ ! -f "${tsc_lib}" ]]; then
    return 1
  fi
  if [[ ! -f "${esbuild_bin}" ]]; then
    return 1
  fi
  if ! node "${tsc_lib}" --version >/dev/null 2>&1; then
    return 1
  fi
  return 0
}

# Поднять/перезапустить unit. Работает и для inactive (после stop) — критично против 502.
deploy_ensure_service() {
  local unit="$1"
  if ! deploy_unit_exists "${unit}"; then
    return 1
  fi
  deploy_log "Запуск ${unit}..."
  systemctl daemon-reload 2>/dev/null || true
  systemctl enable "${unit}" 2>/dev/null || true
  if systemctl is-active --quiet "${unit}" 2>/dev/null; then
    systemctl restart "${unit}" || return 1
  else
    systemctl start "${unit}" || return 1
  fi
  return 0
}

# Совместимость со старыми вызовами
deploy_restart_if_active() {
  deploy_ensure_service "$1"
}

# Поднять все фронт-сервисы, которые останавливали / которые есть на машине.
deploy_restore_node_services() {
  local unit restored=0
  local units=()

  if [[ -f "${STOPPED_UNITS_FILE}" ]]; then
    mapfile -t units < "${STOPPED_UNITS_FILE}" || true
  fi

  if [[ "${#units[@]}" -eq 0 ]]; then
    units=("${FRONTEND_UNITS[@]}")
  fi

  for unit in "${units[@]}"; do
    [[ -z "${unit}" ]] && continue
    if deploy_unit_exists "${unit}"; then
      if deploy_ensure_service "${unit}"; then
        restored=1
      else
        deploy_warn "Не удалось запустить ${unit} — смотрите: journalctl -u ${unit} -n 40"
      fi
    fi
  done

  rm -f "${STOPPED_UNITS_FILE}" 2>/dev/null || true
  return 0
}

deploy_check_port() {
  local port="$1"
  local unit="$2"
  local code

  if ! deploy_unit_exists "${unit}"; then
    return 0
  fi

  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:${port}/" 2>/dev/null || echo 000)"
  if [[ "${code}" == "000" || "${code}" == "502" || "${code}" == "503" ]]; then
    deploy_warn "${unit} :${port} → HTTP ${code} — перезапуск"
    systemctl restart "${unit}" 2>/dev/null || systemctl start "${unit}" 2>/dev/null || true
    sleep 3
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:${port}/" 2>/dev/null || echo 000)"
    if [[ "${code}" == "000" || "${code}" == "502" || "${code}" == "503" ]]; then
      deploy_warn "${unit} всё ещё недоступен (HTTP ${code}). journalctl -u ${unit} -n 40"
      return 1
    fi
  fi
  deploy_log "${unit} OK (HTTP ${code})"
  return 0
}

# Проверка портов после деплоя (502 = nginx без upstream).
deploy_verify_frontends() {
  local failed=0
  deploy_check_port 5173 monstro-web-client || failed=1
  deploy_check_port 5174 monstro-web-admin || failed=1
  deploy_check_port 4321 monstro-public-site || failed=1
  deploy_check_port 5175 monstro-widget || failed=1
  return "${failed}"
}

# Один общий npm install для всего монорепо (никогда не вызывать параллельно из build-*.sh)
deploy_install_all_deps() {
  if [[ "${DEPLOY_NPM_INSTALL_DONE:-0}" == "1" ]]; then
    return 0
  fi

  deploy_npm_acquire_lock
  trap deploy_npm_release_lock EXIT

  deploy_setup_npm_cache
  cd "${INSTALL_DIR}"

  local needs_install=0
  if deploy_lock_needs_install "deps"; then
    needs_install=1
  fi

  if [[ "${needs_install}" -eq 0 ]] && deploy_npm_deps_healthy; then
    deploy_log "npm install пропущен (зависимости OK)"
    bash "${INSTALL_DIR}/scripts/lib/npm-fix-bins.sh"
    export DEPLOY_NPM_INSTALL_DONE=1
    deploy_npm_release_lock
    trap - EXIT
    return 0
  fi

  # Любая переустановка ломает running vite/next → stop заранее, restore после сборки
  if ! deploy_npm_deps_healthy; then
    deploy_warn "node_modules повреждён — полная переустановка зависимостей"
    deploy_remove_node_modules
  else
    deploy_log "npm install (все workspaces)..."
    deploy_stop_node_services
  fi

  if [[ -f package-lock.json ]]; then
    if ! npm ci --include-workspace-root; then
      deploy_warn "npm ci не удался — чистая переустановка"
      deploy_remove_node_modules
      npm ci --include-workspace-root
    fi
  else
    npm install --include-workspace-root
  fi

  bash "${INSTALL_DIR}/scripts/lib/npm-fix-bins.sh"

  if ! deploy_npm_deps_healthy; then
    deploy_fail "npm install завершился, но typescript/esbuild не найдены. Запустите: sudo bash scripts/fix-npm-install.sh"
  fi

  deploy_lock_mark_ok "deps"
  export DEPLOY_NPM_INSTALL_DONE=1
  deploy_npm_release_lock
  trap - EXIT
}

deploy_npm_install() {
  local scope="$1"
  shift

  if [[ "${DEPLOY_NPM_SKIP:-0}" == "1" ]]; then
    return 0
  fi

  deploy_install_all_deps
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

# Перед параллельной сборкой: один npm install + shared-types
deploy_prepare_frontend_builds() {
  deploy_install_all_deps
  deploy_export_frontend_env
  if [[ "${DEPLOY_SHARED_TYPES_SKIP:-0}" != "1" ]]; then
    deploy_log "Сборка shared-types (один раз перед параллельными фронтами)..."
    cd "${INSTALL_DIR}"
    npm run build -w @ai-consultant/shared-types
    export DEPLOY_SHARED_TYPES_SKIP=1
  fi
  export DEPLOY_NPM_SKIP=1
}
