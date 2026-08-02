#!/usr/bin/env bash
# Сборка и запуск AI-виджета (embed.js + iframe) на порту 5175
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/monstro_chat_ai}"
cd "${INSTALL_DIR}"

log() { echo -e "\n\033[1;32m==>\033[0m $*"; }
fail() { echo -e "\033[1;31mERROR:\033[0m $*" >&2; exit 1; }

[[ "${EUID:-$(id -u)}" -eq 0 ]] || fail "Запустите от root: sudo bash scripts/start-widget.sh"

IP=$(curl -4 -s --max-time 3 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

install_node() {
  if command -v node >/dev/null 2>&1 && [[ "$(node -v | cut -d. -f1 | tr -d v)" -ge 22 ]]; then
    return
  fi
  log "Устанавливаю Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
}

build_widget() {
  log "Собираю AI-виджет (embed.js + iframe)..."
  npm install \
    --workspace=@ai-consultant/shared-types \
    --workspace=@ai-consultant/widget \
    --include-workspace-root
  npm run build -w @ai-consultant/shared-types
  npm run build -w @ai-consultant/widget
}

start_service() {
  local unit="/etc/systemd/system/monstro-widget.service"
  cat > "${unit}" << EOF
[Unit]
Description=Monstro AI Chat Widget (embed.js + iframe)
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
WorkingDirectory=${INSTALL_DIR}/apps/widget
Environment=NODE_ENV=production
Environment=PORT=5175
Environment=HOST=0.0.0.0
ExecStart=$(command -v node) scripts/serve-static.mjs
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable monstro-widget
  systemctl restart monstro-widget
  ufw allow 5175/tcp 2>/dev/null || true
}

wait_widget() {
  local i
  for i in $(seq 1 15); do
    if curl -sf http://127.0.0.1:5175/health.txt | grep -q '^ok'; then
      return 0
    fi
    sleep 2
  done
  return 1
}

log "Monstro — AI-виджет чата"
install_node
build_widget
start_service

sleep 2
if wait_widget; then
  echo ""
  echo "=============================================="
  echo "  AI-ВИДЖЕТ ЗАПУЩЕН"
  echo "=============================================="
  echo ""
  echo "  embed.js:  http://${IP}:5175/embed.js"
  echo "  iframe:    http://${IP}:5175/iframe/"
  echo ""
  echo "  Логи: journalctl -u monstro-widget -f"
else
  journalctl -u monstro-widget -n 20 --no-pager
  fail "Виджет не отвечает на :5175"
fi
