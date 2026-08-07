#!/usr/bin/env bash
# Запуск фронтенда (кабинет + админка) на сервере
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/monstro_chat_ai}"
cd "${INSTALL_DIR}"

log()  { echo -e "\n\033[1;32m==>\033[0m $*"; }
fail() { echo -e "\033[1;31mERROR:\033[0m $*" >&2; exit 1; }

[[ "${EUID:-$(id -u)}" -eq 0 ]] || fail "Запустите от root: sudo bash scripts/start-frontend.sh"

detect_ip() {
  curl -4 -s --max-time 3 ifconfig.me 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}'
}

install_node() {
  if command -v node >/dev/null 2>&1 && [[ "$(node -v | cut -d. -f1 | tr -d v)" -ge 22 ]]; then
    log "Node.js уже установлен: $(node -v)"
    return
  fi
  log "Устанавливаю Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
  log "Node.js: $(node -v)"
}

build_frontends() {
  if [[ "${SKIP_FRONTEND_BUILD:-0}" == "1" ]]; then
    log "Сборка фронтенда пропущена (SKIP_FRONTEND_BUILD=1) — только systemd unit"
    return 0
  fi
  log "Собираю фронтенд (3–5 мин)..."
  local ip
  ip=$(detect_ip)
  export VITE_WIDGET_SCRIPT_URL="http://${ip}:5175/embed.js"
  export VITE_WIDGET_URL="http://${ip}:5175"
  export VITE_API_URL="http://${ip}:3000/api"
  # Один npm ci на всё монорепо (без параллельных install — ломают node_modules)
  # shellcheck source=lib/deploy-common.sh
  source "${INSTALL_DIR}/scripts/lib/deploy-common.sh"
  if [[ "${DEPLOY_NPM_SKIP:-0}" != "1" ]]; then
    deploy_install_all_deps
  fi
  if [[ "${DEPLOY_SHARED_TYPES_SKIP:-0}" != "1" ]]; then
    npm run build -w @ai-consultant/shared-types
  fi
  npm run build -w @ai-consultant/web-client
  npm run build -w @ai-consultant/web-admin
}

start_service() {
  local name="$1"
  local workdir="$2"
  local port="$3"
  local unit="/etc/systemd/system/${name}.service"

  log "Запускаю ${name} на порту ${port}..."

  cat > "${unit}" << EOF
[Unit]
Description=${name}
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
WorkingDirectory=${workdir}
ExecStart=$(command -v npm) run preview -- --host 0.0.0.0 --port ${port}
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable "${name}"
  systemctl restart "${name}"
}

open_ports() {
  if command -v ufw >/dev/null 2>&1; then
    ufw allow 5173/tcp >/dev/null 2>&1 || true
    ufw allow 5174/tcp >/dev/null 2>&1 || true
  fi
}

wait_http() {
  local port="$1"
  local i
  for i in $(seq 1 12); do
    if curl -sf "http://127.0.0.1:${port}/health.txt" 2>/dev/null | grep -q '^ok'; then
      return 0
    fi
    sleep 2
  done
  return 1
}

main() {
  local ip
  ip=$(detect_ip)

  log "Monstro Chat AI — запуск фронтенда"
  install_node
  build_frontends

  start_service "monstro-web-client" "${INSTALL_DIR}/apps/web-client" 5173
  start_service "monstro-web-admin" "${INSTALL_DIR}/apps/web-admin" 5174
  open_ports

  sleep 3
  systemctl status monstro-web-client --no-pager -l | head -5 || true
  systemctl status monstro-web-admin --no-pager -l | head -5 || true

  echo ""
  echo "=============================================="
  if wait_http 5173 && wait_http 5174; then
    echo "  ФРОНТЕНД ЗАПУЩЕН"
    echo "=============================================="
    echo ""
    echo "  Кабинет:  http://${ip}:5173"
    echo "  Админка:  http://${ip}:5174"
    echo "  API:      http://${ip}:3000/api/health"
    echo ""
    echo "  Логи кабинета: journalctl -u monstro-web-client -f"
    echo "  Логи админки:  journalctl -u monstro-web-admin -f"
  else
    echo "  ФРОНТЕНД НЕ ОТВЕЧАЕТ — смотрите логи"
    echo "=============================================="
    journalctl -u monstro-web-client -n 20 --no-pager || true
    journalctl -u monstro-web-admin -n 20 --no-pager || true
    exit 1
  fi
}

main "$@"
