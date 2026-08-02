#!/usr/bin/env bash
# Monstro Chat AI — автоматическая установка на Ubuntu-сервер
# Использование: curl -fsSL .../install-server.sh | bash
#           или: bash scripts/install-server.sh
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/venomimonstro/monstro_chat_ai.git}"
INSTALL_DIR="${INSTALL_DIR:-/opt/monstro_chat_ai}"
BRANCH="${BRANCH:-main}"

log()  { echo -e "\n\033[1;32m==>\033[0m $*"; }
warn() { echo -e "\033[1;33m!!\033[0m $*"; }
fail() { echo -e "\033[1;31mERROR:\033[0m $*" >&2; exit 1; }

require_root() {
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    fail "Запустите от root: sudo bash scripts/install-server.sh"
  fi
}

detect_ip() {
  local ip
  ip=$(curl -4 -s --max-time 3 ifconfig.me 2>/dev/null || true)
  if [[ -z "$ip" ]]; then
    ip=$(hostname -I 2>/dev/null | awk '{print $1}')
  fi
  [[ -n "$ip" ]] || ip="127.0.0.1"
  echo "$ip"
}

ensure_swap() {
  local swap_kb
  swap_kb=$(awk '/^SwapTotal:/ {print $2}' /proc/meminfo 2>/dev/null || echo 0)
  if [[ "${swap_kb:-0}" -lt 1048576 ]]; then
    log "Добавляю swap 2G (мало RAM)..."
    if [[ ! -f /swapfile ]]; then
      if fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=progress; then
        chmod 600 /swapfile
        mkswap /swapfile
        swapon /swapfile
        grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
      else
        warn "Не удалось создать swap — продолжаю без него"
      fi
    else
      swapon /swapfile 2>/dev/null || true
    fi
  fi
}

install_docker() {
  if command -v docker >/dev/null 2>&1; then
    log "Docker уже установлен: $(docker --version)"
    return
  fi
  log "Устанавливаю Docker..."
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
}

clone_or_update() {
  log "Клонирую/обновляю репозиторий в ${INSTALL_DIR}..."
  apt-get install -y -qq git curl
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
}

write_env() {
  local ip="$1"
  log "Создаю .env (секреты генерируются автоматически)..."
  cat > .env << EOF
DATABASE_URL=postgresql://aicw:aicw_dev_password@postgres:5432/aicw?schema=public
REDIS_URL=redis://redis:6379
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY=aicw_minio
S3_SECRET_KEY=aicw_minio_secret
S3_BUCKET=aicw-files
S3_REGION=us-east-1

API_PORT=3000
API_HOST=0.0.0.0
NODE_ENV=production

JWT_SECRET=$(openssl rand -hex 32)
INTEGRATION_ENCRYPTION_KEY=$(openssl rand -hex 16)
TWO_FA_SECRET_KEY=$(openssl rand -hex 16)

YOOKASSA_SHOP_ID=000000
YOOKASSA_SECRET_KEY=placeholder_yookassa_secret
YOOKASSA_WEBHOOK_SECRET=placeholder_webhook_secret

WEB_CLIENT_URL=http://${ip}:5173
WEB_ADMIN_URL=http://${ip}:5174
WIDGET_URL=http://${ip}:5175
PUBLIC_SITE_URL=http://${ip}:4321
API_PUBLIC_URL=http://${ip}:3000/api
COOKIE_SECURE=false
RELEASE_DEPLOY_TOKEN=$(openssl rand -hex 24)
APP_VERSION=0.33.0
SPRINT_NUMBER=33
EOF
}

clean_host_node_modules() {
  log "Удаляю локальный node_modules (мешает Docker-сборке)..."
  rm -rf node_modules apps/*/node_modules packages/*/node_modules
}

deploy_stack() {
  log "Собираю и запускаю Docker-стек (3–10 мин)..."
  docker compose down --remove-orphans 2>/dev/null || true
  # Сначала образ API — migrate использует тот же image
  docker compose build api
  docker compose up -d --no-build
}

wait_for_api() {
  log "Жду запуск API (до 120 сек)..."
  local i
  for i in $(seq 1 24); do
    if curl -sf http://localhost:3000/api/health >/dev/null 2>&1; then
      return 0
    fi
    sleep 5
    echo -n "."
  done
  echo ""
  return 1
}

open_firewall() {
  if command -v ufw >/dev/null 2>&1; then
    log "Открываю порты в firewall..."
    ufw allow 22/tcp  >/dev/null 2>&1 || true
    ufw allow 3000/tcp >/dev/null 2>&1 || true
    ufw allow 5173/tcp >/dev/null 2>&1 || true
    ufw allow 5174/tcp >/dev/null 2>&1 || true
    ufw --force enable >/dev/null 2>&1 || true
  fi
}

seed_qa_accounts() {
  log "Создаю тестовые аккаунты..."
  bash "${INSTALL_DIR}/scripts/seed-qa.sh" || warn "Seed не выполнен — запустите вручную: bash scripts/seed-qa.sh"
}

print_success() {
  local ip="$1"
  echo ""
  echo "=============================================="
  echo "  УСТАНОВКА ЗАВЕРШЕНА"
  echo "=============================================="
  echo ""
  echo "  API health:  http://${ip}:3000/api/health"
  echo "  API:         http://${ip}:3000/api"
  echo ""
  echo "  Кабинет:     http://${ip}:5173"
  echo "  Админка:     http://${ip}:5174"
  echo ""
  echo "  Тестовые логины (после seed):"
  echo "    Клиент:  client@demo.local / Test1234!"
  echo "    Админ:   admin@chat24ai.local / Test1234!"
  echo ""
  echo "  Логи:        cd ${INSTALL_DIR} && docker compose logs -f api"
  echo "  Статус:      cd ${INSTALL_DIR} && docker compose ps"
  echo "  Перезапуск:  cd ${INSTALL_DIR} && docker compose restart api"
  echo ""
  curl -s "http://localhost:3000/api/health" || true
  echo ""
}

print_failure() {
  echo ""
  echo "=============================================="
  echo "  УСТАНОВКА НЕ УДАЛАСЬ"
  echo "=============================================="
  echo ""
  cd "${INSTALL_DIR}" 2>/dev/null || true
  docker compose ps 2>/dev/null || true
  echo ""
  docker compose logs api --tail 40 2>/dev/null || true
  exit 1
}

main() {
  require_root
  local ip
  ip=$(detect_ip)

  log "Monstro Chat AI — установка на ${ip}"
  ensure_swap
  install_docker
  clone_or_update
  write_env "${ip}"
  clean_host_node_modules
  deploy_stack
  open_firewall

  if wait_for_api; then
    seed_qa_accounts
    print_success "${ip}"
  else
    print_failure
  fi
}

main "$@"
