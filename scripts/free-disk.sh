#!/usr/bin/env bash
# Освободить место на диске перед Docker-сборкой (без удаления БД)
# Usage: sudo bash scripts/free-disk.sh
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/monstro_chat_ai}"
MIN_FREE_GB="${MIN_FREE_GB:-4}"

log()  { echo -e "\n\033[1;32m==>\033[0m $*"; }
warn() { echo -e "\033[1;33m!!\033[0m $*"; }

free_gb() {
  df -BG / | awk 'NR==2 {gsub(/G/,"",$4); print $4}'
}

show_disk() {
  log "Диск:"
  df -h /
  echo "Свободно: $(free_gb) GB"
}

need_cleanup() {
  [[ "$(free_gb)" -lt "${MIN_FREE_GB}" ]]
}

prune_docker_build_cache() {
  log "Очищаю Docker build cache и dangling-образы..."
  docker builder prune -af 2>/dev/null || true
  docker image prune -af 2>/dev/null || true
}

prune_frontend_artifacts() {
  log "Удаляю артефакты сборки фронтенда на хосте..."
  rm -rf "${INSTALL_DIR}/node_modules" \
    "${INSTALL_DIR}/apps/api/node_modules" \
    "${INSTALL_DIR}/apps/web-client/node_modules" \
    "${INSTALL_DIR}/apps/web-admin/node_modules" \
    "${INSTALL_DIR}/apps/public-site/node_modules" \
    "${INSTALL_DIR}/apps/widget/node_modules" \
    "${INSTALL_DIR}/packages/shared-types/node_modules" \
    "${INSTALL_DIR}/apps/web-client/dist" \
    "${INSTALL_DIR}/apps/web-admin/dist" \
    "${INSTALL_DIR}/apps/public-site/.next" \
    2>/dev/null || true
  npm cache clean --force 2>/dev/null || true
}

prune_system_junk() {
  log "Очищаю apt, журналы и /tmp..."
  apt-get autoremove -y -qq 2>/dev/null || true
  apt-get clean 2>/dev/null || true
  journalctl --vacuum-size=80M 2>/dev/null || true
  find /tmp -mindepth 1 -maxdepth 1 -mtime +1 -exec rm -rf {} + 2>/dev/null || true
}

prune_old_docker_images() {
  log "Удаляю неиспользуемые Docker-образы (контейнеры и тома БД не трогаю)..."
  # НЕ используем volume prune — после compose down можно случайно удалить postgres_data
  docker system prune -af 2>/dev/null || true
}

stop_api_for_build() {
  log "Останавливаю только API-контейнер перед пересборкой..."
  docker compose -f "${INSTALL_DIR}/docker-compose.yml" stop api 2>/dev/null || true
}

main() {
  [[ "${EUID:-$(id -u)}" -eq 0 ]] || {
    echo "Запустите от root: sudo bash scripts/free-disk.sh" >&2
    exit 1
  }

  show_disk

  if ! need_cleanup; then
    log "Места достаточно (нужно ≥ ${MIN_FREE_GB} GB)."
    exit 0
  fi

  warn "Мало места (< ${MIN_FREE_GB} GB). Запускаю очистку..."

  prune_docker_build_cache
  show_disk
  if ! need_cleanup; then exit 0; fi

  prune_frontend_artifacts
  show_disk
  if ! need_cleanup; then exit 0; fi

  prune_system_junk
  show_disk
  if ! need_cleanup; then exit 0; fi

  stop_api_for_build
  prune_old_docker_images
  show_disk

  if need_cleanup; then
    warn "Всё ещё мало места ($(free_gb) GB). Увеличьте диск в панели хостинга."
    warn "Проверьте: du -sh /var/lib/docker/* | sort -h | tail -10"
    exit 1
  fi

  log "Готово. Можно деплоить: sudo bash scripts/deploy-latest.sh"
}

main "$@"
