#!/usr/bin/env bash
# Обновление Monstro Chat AI на уже установленном сервере
# Использование: sudo bash scripts/deploy-update.sh
#           или: sudo BRANCH=cursor/sprint-32-llm-keys-public-chat-ab3a bash scripts/deploy-update.sh
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/venomimonstro/monstro_chat_ai.git}"
INSTALL_DIR="${INSTALL_DIR:-/opt/monstro_chat_ai}"
BRANCH="${BRANCH:-main}"

log()  { echo -e "\n\033[1;32m==>\033[0m $*"; }
warn() { echo -e "\033[1;33m!!\033[0m $*"; }
fail() { echo -e "\033[1;31mERROR:\033[0m $*" >&2; exit 1; }

require_root() {
  [[ "${EUID:-$(id -u)}" -eq 0 ]] || fail "Запустите от root: sudo bash scripts/deploy-update.sh"
}

detect_ip() {
  curl -4 -s --max-time 3 ifconfig.me 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}'
}

pull_code() {
  log "Обновляю код из ${BRANCH}..."
  [[ -d "${INSTALL_DIR}/.git" ]] || fail "Репозиторий не найден: ${INSTALL_DIR}"
  cd "${INSTALL_DIR}"
  git fetch origin
  git checkout "${BRANCH}"
  git reset --hard "origin/${BRANCH}"
  log "Коммит: $(git log -1 --oneline)"
}

rebuild_api() {
  log "Пересобираю API (Docker)..."
  cd "${INSTALL_DIR}"
  export DOCKER_BUILDKIT=1
  export COMPOSE_DOCKER_CLI_BUILD=1
  rm -rf node_modules apps/*/node_modules packages/*/node_modules 2>/dev/null || true
  docker compose build api
  docker compose up -d --force-recreate api
}

wait_for_api() {
  log "Жду API..."
  local i
  for i in $(seq 1 24); do
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
  if ! command -v node >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y -qq nodejs
  fi
  npm install \
    --workspace=@ai-consultant/shared-types \
    --workspace=@ai-consultant/web-admin \
    --include-workspace-root
  bash "${INSTALL_DIR}/scripts/lib/npm-fix-bins.sh"
  npm run build -w @ai-consultant/shared-types
  npm run build -w @ai-consultant/web-admin
  if systemctl is-active --quiet monstro-web-admin 2>/dev/null; then
    systemctl restart monstro-web-admin
  else
    bash "${INSTALL_DIR}/scripts/start-frontend.sh"
  fi
}

rebuild_public_site() {
  log "Пересобираю публичный сайт..."
  cd "${INSTALL_DIR}"
  npm install \
    --workspace=@ai-consultant/shared-types \
    --workspace=@ai-consultant/public-site \
    --include-workspace-root
  bash "${INSTALL_DIR}/scripts/lib/npm-fix-bins.sh"
  npm run build -w @ai-consultant/shared-types
  npm run build -w @ai-consultant/public-site
  if systemctl is-active --quiet monstro-public-site 2>/dev/null; then
    systemctl restart monstro-public-site
  else
    bash "${INSTALL_DIR}/scripts/start-public-site.sh"
  fi
}

print_status() {
  local ip
  ip=$(detect_ip)
  echo ""
  echo "=============================================="
  echo "  ОБНОВЛЕНИЕ ЗАВЕРШЕНО"
  echo "=============================================="
  echo ""
  echo "  API:         http://${ip}:3000/api/health"
  echo "  Админка:     http://${ip}:5174"
  echo "  Публичный:   http://${ip}:4321"
  echo ""
  curl -s "http://127.0.0.1:3000/api/admin/status" 2>/dev/null | head -c 200 || true
  echo ""
  docker compose -f "${INSTALL_DIR}/docker-compose.yml" ps 2>/dev/null || true
}

main() {
  require_root
  log "Monstro Chat AI — обновление (ветка ${BRANCH})"
  pull_code
  rebuild_api
  wait_for_api || fail "API не поднялся — смотрите: docker compose logs api --tail 50"
  rebuild_admin
  rebuild_public_site
  print_status
}

main "$@"
