#!/usr/bin/env bash
# Полное обновление Monstro Chat AI на сервере (Sprint 32+)
# Одна команда с сервера:
#   curl -fsSL https://raw.githubusercontent.com/venomimonstro/monstro_chat_ai/main/scripts/remote-update.sh | sudo bash
#
# Или локально:
#   sudo bash scripts/remote-update.sh
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/venomimonstro/monstro_chat_ai.git}"
INSTALL_DIR="${INSTALL_DIR:-/opt/monstro_chat_ai}"
BRANCH="${BRANCH:-main}"

log()  { echo -e "\n\033[1;32m==>\033[0m $*"; }
warn() { echo -e "\033[1;33m!!\033[0m $*"; }
fail() { echo -e "\033[1;31mERROR:\033[0m $*" >&2; exit 1; }

require_root() {
  [[ "${EUID:-$(id -u)}" -eq 0 ]] || fail "Запустите от root: sudo bash ..."
}

detect_ip() {
  curl -4 -s --max-time 3 ifconfig.me 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}'
}

ensure_swap() {
  local swap_kb
  swap_kb=$(awk '/^SwapTotal:/ {print $2}' /proc/meminfo 2>/dev/null || echo 0)
  if [[ "${swap_kb:-0}" -lt 1048576 ]]; then
    log "Добавляю swap 2G (мало RAM для сборки)..."
    if [[ ! -f /swapfile ]]; then
      fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
      chmod 600 /swapfile
      mkswap /swapfile
      swapon /swapfile
      grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
    else
      swapon /swapfile 2>/dev/null || true
    fi
  fi
}

ensure_node() {
  if command -v node >/dev/null 2>&1 && [[ "$(node -v | cut -d. -f1 | tr -d v)" -ge 22 ]]; then
    log "Node.js: $(node -v)"
    return
  fi
  log "Устанавливаю Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
  log "Node.js: $(node -v)"
}

pull_code() {
  log "Обновляю код (${BRANCH})..."
  apt-get install -y -qq git curl ca-certificates 2>/dev/null || true

  if [[ -d "${INSTALL_DIR}/.git" ]]; then
    cd "${INSTALL_DIR}"
    git fetch origin
    git checkout "${BRANCH}"
    git reset --hard "origin/${BRANCH}"
  else
    mkdir -p "$(dirname "${INSTALL_DIR}")"
    rm -rf "${INSTALL_DIR}"
    git clone --branch "${BRANCH}" "${REPO_URL}" "${INSTALL_DIR}"
    cd "${INSTALL_DIR}"
  fi

  log "Коммит: $(git log -1 --oneline)"
}

rebuild_api() {
  log "Пересобираю API (Docker, 5–15 мин)..."
  cd "${INSTALL_DIR}"
  rm -rf node_modules apps/*/node_modules packages/*/node_modules 2>/dev/null || true
  docker compose build api
  docker compose up -d --force-recreate api
}

wait_for_api() {
  log "Жду API..."
  local i
  for i in $(seq 1 30); do
    if curl -sf http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
      return 0
    fi
    sleep 5
    echo -n "."
  done
  echo ""
  return 1
}

rebuild_admin() {
  log "Пересобираю админку..."
  cd "${INSTALL_DIR}"
  ensure_node
  npm install \
    --workspace=@ai-consultant/shared-types \
    --workspace=@ai-consultant/web-admin \
    --include-workspace-root
  npm run build -w @ai-consultant/shared-types
  npm run build -w @ai-consultant/web-admin

  if systemctl is-active --quiet monstro-web-admin 2>/dev/null; then
    systemctl restart monstro-web-admin
  else
    warn "Запускаю админку через start-frontend.sh..."
    bash "${INSTALL_DIR}/scripts/start-frontend.sh"
  fi
}

rebuild_public_site() {
  log "Пересобираю публичный сайт..."
  cd "${INSTALL_DIR}"
  ensure_node
  npm install \
    --workspace=@ai-consultant/shared-types \
    --workspace=@ai-consultant/public-site \
    --include-workspace-root
  npm run build -w @ai-consultant/shared-types
  npm run build -w @ai-consultant/public-site

  if systemctl is-active --quiet monstro-public-site 2>/dev/null; then
    systemctl restart monstro-public-site
  else
    warn "Запускаю публичный сайт через start-public-site.sh..."
    bash "${INSTALL_DIR}/scripts/start-public-site.sh"
  fi
}

verify_update() {
  log "Проверяю версию..."
  local response
  response=$(curl -sf http://127.0.0.1:3000/api/public/demo-widget 2>/dev/null || echo '{}')

  if echo "${response}" | grep -q 'demoWidgetKey'; then
    log "OK: API обновлён (Sprint 32+)"
    echo "  ${response}"
    return 0
  fi

  warn "API всё ещё старая версия!"
  echo "  Ответ: ${response}"
  echo "  Ожидалось поле demoWidgetKey"
  return 1
}

print_done() {
  local ip
  ip=$(detect_ip)
  echo ""
  echo "=============================================="
  echo "  ОБНОВЛЕНИЕ ЗАВЕРШЕНО"
  echo "=============================================="
  echo ""
  echo "  API:       http://${ip}:3000/api/health"
  echo "  Админка:   http://${ip}:5174  → Сайт / чат"
  echo "  Сайт:      http://${ip}:4321"
  echo ""
  echo "  Проверка:  curl http://${ip}:3000/api/public/demo-widget"
  echo ""
}

main() {
  require_root
  log "Monstro Chat AI — remote update"
  ensure_swap
  pull_code
  rebuild_api
  wait_for_api || {
    docker compose -f "${INSTALL_DIR}/docker-compose.yml" logs api --tail 40
    fail "API не поднялся"
  }
  rebuild_admin
  rebuild_public_site
  verify_update || fail "Обновление не применилось — пришлите вывод этой команды"
  print_done
}

main "$@"
