#!/usr/bin/env bash
# Быстрое обновление: только изменённые компоненты, параллельная сборка, кэш npm
#
# Usage:
#   sudo bash scripts/fast-update.sh              # авто по git diff
#   sudo bash scripts/fast-update.sh --full       # всё как remote-update
#   sudo bash scripts/fast-update.sh --widget     # только виджет (~1–2 мин)
#   sudo bash scripts/fast-update.sh --site       # только публичный сайт
#   sudo bash scripts/fast-update.sh --api        # только API
#   sudo bash scripts/fast-update.sh --frontends  # ЛК + админка
#   sudo bash scripts/fast-update.sh --no-pull    # без git pull
#
# Переменные:
#   API_USE_GHCR=1     — сначала pull API из GitHub Container Registry
#   PARALLEL_BUILDS=1  — параллельная сборка фронтов (по умолчанию 1)
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/venomimonstro/monstro_chat_ai.git}"
INSTALL_DIR="${INSTALL_DIR:-/opt/monstro_chat_ai}"
BRANCH="${BRANCH:-main}"
MODE="auto"
DO_PULL=1
PARALLEL_BUILDS="${PARALLEL_BUILDS:-1}"

# shellcheck source=lib/deploy-common.sh
source "${INSTALL_DIR}/scripts/lib/deploy-common.sh" 2>/dev/null || true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --full) MODE="full" ;;
    --auto) MODE="auto" ;;
    --api) MODE="api" ;;
    --widget) MODE="widget" ;;
    --frontends) MODE="frontends" ;;
    --site) MODE="site" ;;
    --no-pull) DO_PULL=0 ;;
    --sequential) PARALLEL_BUILDS=0 ;;
    -h|--help)
      sed -n '2,14p' "$0"
      exit 0
      ;;
    *) deploy_fail "Неизвестный аргумент: $1" ;;
  esac
  shift
done

[[ "${EUID:-$(id -u)}" -eq 0 ]] || deploy_fail "Запустите от root: sudo bash scripts/fast-update.sh"

START_TS=$(date +%s)

pull_code() {
  [[ "${DO_PULL}" -eq 1 ]] || return 0
  deploy_log "git pull (${BRANCH})..."
  apt-get install -y -qq git curl ca-certificates 2>/dev/null || true
  cd "${INSTALL_DIR}"
  git fetch origin
  git checkout "${BRANCH}"
  git reset --hard "origin/${BRANCH}"
  deploy_log "Коммит: $(git log -1 --oneline)"
  deploy_after_git_pull
}

resolve_components() {
  local detected=""
  case "${MODE}" in
    full) echo "api widget frontends site" ;;
    api) echo "api" ;;
    widget) echo "widget" ;;
    frontends) echo "frontends" ;;
    site) echo "site" ;;
    auto)
      detected="$(deploy_detect_components)"
      if [[ -z "${detected// }" ]]; then
        deploy_warn "Нет изменений с прошлого деплоя — используйте --full или --widget/--site"
        echo ""
      else
        echo "${detected}"
      fi
      ;;
  esac
}

needs() {
  local list="$1" item="$2"
  [[ " ${list} " == *" ${item} "* ]]
}

run_parallel_builds() {
  local components="$1"
  local pids=() names=()

  if needs "${components}" "widget"; then
    deploy_log "[parallel] виджет"
    bash "${INSTALL_DIR}/scripts/lib/build-widget.sh" &
    pids+=($!)
    names+=("widget")
  fi
  if needs "${components}" "frontends"; then
    deploy_log "[parallel] ЛК + админка"
    bash "${INSTALL_DIR}/scripts/lib/build-frontends.sh" &
    pids+=($!)
    names+=("frontends")
  fi
  if needs "${components}" "site"; then
    deploy_log "[parallel] публичный сайт"
    bash "${INSTALL_DIR}/scripts/lib/build-site.sh" &
    pids+=($!)
    names+=("site")
  fi

  local i failed=0
  for i in "${!pids[@]}"; do
    if ! wait "${pids[$i]}"; then
      deploy_fail "Сборка ${names[$i]} провалена"
    fi
  done
}

run_sequential_builds() {
  local components="$1"
  needs "${components}" "widget" && bash "${INSTALL_DIR}/scripts/lib/build-widget.sh"
  needs "${components}" "frontends" && bash "${INSTALL_DIR}/scripts/lib/build-frontends.sh"
  needs "${components}" "site" && bash "${INSTALL_DIR}/scripts/lib/build-site.sh"
}

ensure_swap() {
  local swap_kb
  swap_kb=$(awk '/^SwapTotal:/ {print $2}' /proc/meminfo 2>/dev/null || echo 0)
  if [[ "${swap_kb:-0}" -lt 1048576 ]] && [[ ! -f /swapfile ]]; then
    deploy_warn "Мало swap — полный деплой может быть медленным"
  fi
}

ensure_disk_space() {
  if [[ -f "${INSTALL_DIR}/scripts/free-disk.sh" ]]; then
    bash "${INSTALL_DIR}/scripts/free-disk.sh" || deploy_fail "Недостаточно места на диске"
  fi
}

main() {
  deploy_log "Monstro — fast update (режим: ${MODE})"
  deploy_setup_npm_cache

  [[ "${MODE}" == "full" ]] && ensure_swap

  local prev_sha=""
  prev_sha="$(deploy_load_sha 2>/dev/null || true)"

  pull_code

  # После pull — актуальный free-disk.sh; чистим до любой Docker/npm сборки
  if [[ "${MODE}" == "full" ]]; then
    ensure_disk_space
  fi

  local new_sha components
  new_sha="$(git -C "${INSTALL_DIR}" rev-parse HEAD)"
  components="$(resolve_components)"

  if [[ -z "${components// }" ]]; then
    deploy_log "Нечего обновлять"
    deploy_save_sha "${new_sha}"
    exit 0
  fi

  deploy_log "Компоненты: ${components}"
  [[ -n "${prev_sha}" ]] && deploy_log "Diff: ${prev_sha:0:8} → ${new_sha:0:8}"

  # API / auto: всегда проверяем диск (иначе buildx падает с no space left)
  if needs "${components}" "api"; then
    ensure_disk_space
    bash "${INSTALL_DIR}/scripts/lib/build-api.sh"
  fi

  if needs "${components}" "widget" \
    || needs "${components}" "frontends" \
    || needs "${components}" "site"; then
    deploy_npm_install_for_components "${components}"
  fi

  if [[ "${PARALLEL_BUILDS}" == "1" ]]; then
    run_parallel_builds "${components}"
  else
    run_sequential_builds "${components}"
  fi

  if [[ "${MODE}" == "full" ]] || needs "${components}" "api"; then
    bash "${INSTALL_DIR}/scripts/ensure-boot-stability.sh" 2>/dev/null || true
  fi

  if [[ "${MODE}" == "full" ]]; then
    bash "${INSTALL_DIR}/scripts/verify-release.sh" post 2>/dev/null || deploy_warn "verify-release post пропущен"
  fi

  deploy_save_sha "${new_sha}"

  local elapsed=$(( $(date +%s) - START_TS ))
  local ip
  ip="$(deploy_detect_ip)"
  echo ""
  echo "=============================================="
  echo "  FAST UPDATE OK за ${elapsed}с"
  echo "=============================================="
  echo "  Компоненты: ${components}"
  echo "  API:     http://${ip}:3000/api/health"
  echo "  Виджет:  http://${ip}:5175/embed.js"
  echo "  Сайт:    http://${ip}:4321"
  echo ""
  echo "  Только виджет:  sudo bash scripts/fast-update.sh --widget"
  echo "  Полный деплой:  sudo bash scripts/fast-update.sh --full"
  echo ""
}

main "$@"
