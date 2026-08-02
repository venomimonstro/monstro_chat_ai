#!/usr/bin/env bash
# Публичный сайт (Next.js) на порту 4321
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/monstro_chat_ai}"
cd "${INSTALL_DIR}"

log() { echo -e "\n\033[1;32m==>\033[0m $*"; }

IP=$(curl -4 -s --max-time 3 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

install_node() {
  if command -v node >/dev/null 2>&1 && [[ "$(node -v | cut -d. -f1 | tr -d v)" -ge 22 ]]; then
    return
  fi
  log "Устанавливаю Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
}

build_site() {
  log "Собираю публичный сайт..."
  npm install \
    --workspace=@ai-consultant/shared-types \
    --workspace=@ai-consultant/public-site \
    --include-workspace-root
  bash "${INSTALL_DIR}/scripts/lib/npm-fix-bins.sh"
  npm run build -w @ai-consultant/shared-types
  npm run build -w @ai-consultant/public-site
}

start_service() {
  local unit="/etc/systemd/system/monstro-public-site.service"
  cat > "${unit}" << EOF
[Unit]
Description=Monstro Public Site
After=network.target docker.service

[Service]
Type=simple
WorkingDirectory=${INSTALL_DIR}/apps/public-site
Environment=NODE_ENV=production
Environment=PORT=4321
Environment=PUBLIC_SITE_URL=http://${IP}:4321
Environment=NEXT_PUBLIC_SITE_URL=http://${IP}:4321
Environment=NEXT_PUBLIC_CLIENT_URL=http://${IP}:5173
Environment=NEXT_PUBLIC_WIDGET_URL=http://${IP}:5175
Environment=NEXT_PUBLIC_API_URL=http://${IP}:3000/api
Environment=API_INTERNAL_URL=http://127.0.0.1:3000
ExecStart=$(command -v npm) run start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable monstro-public-site
  systemctl restart monstro-public-site
  ufw allow 4321/tcp 2>/dev/null || true
}

log "Monstro — публичный сайт"
install_node
build_site
start_service

sleep 5
if curl -sf "http://127.0.0.1:4321/" >/dev/null; then
  echo ""
  echo "Публичный сайт: http://${IP}:4321"
else
  journalctl -u monstro-public-site -n 15 --no-pager
  exit 1
fi
