#!/usr/bin/env bash
# systemd-юниты с EnvironmentFile=.env (домен redflow.ru из apply-redflow-env)
set -euo pipefail

sync_systemd_units() {
  local install_dir="${1:?INSTALL_DIR required}"
  local node_bin
  node_bin="$(command -v node)"
  local vite_js="${install_dir}/node_modules/vite/bin/vite.js"
  local next_js="${install_dir}/node_modules/next/dist/bin/next"

  cat > /etc/systemd/system/monstro-public-site.service << EOF
[Unit]
Description=RedFlow Public Site (Next.js)
After=network.target docker.service

[Service]
Type=simple
WorkingDirectory=${install_dir}/apps/public-site
EnvironmentFile=-${install_dir}/.env
Environment=NODE_ENV=production
Environment=PORT=4321
Environment=HOSTNAME=0.0.0.0
ExecStart=${node_bin} ${next_js} start -H 0.0.0.0 -p 4321
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

  cat > /etc/systemd/system/monstro-web-client.service << EOF
[Unit]
Description=RedFlow Web Client
After=network.target docker.service

[Service]
Type=simple
WorkingDirectory=${install_dir}/apps/web-client
EnvironmentFile=-${install_dir}/.env
Environment=NODE_ENV=production
Environment=VITE_BASE_PATH=/app/
ExecStart=${node_bin} ${vite_js} preview --host 0.0.0.0 --port 5173
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

  cat > /etc/systemd/system/monstro-web-admin.service << EOF
[Unit]
Description=RedFlow Web Admin
After=network.target docker.service

[Service]
Type=simple
WorkingDirectory=${install_dir}/apps/web-admin
EnvironmentFile=-${install_dir}/.env
Environment=NODE_ENV=production
Environment=VITE_BASE_PATH=/admin/
ExecStart=${node_bin} ${vite_js} preview --host 0.0.0.0 --port 5174
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

  cat > /etc/systemd/system/monstro-widget.service << EOF
[Unit]
Description=RedFlow Widget
After=network.target docker.service

[Service]
Type=simple
WorkingDirectory=${install_dir}/apps/widget
EnvironmentFile=-${install_dir}/.env
Environment=PORT=5175
Environment=HOST=0.0.0.0
ExecStart=$(command -v node) ${install_dir}/apps/widget/scripts/serve-static.mjs
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload

  for unit in monstro-public-site monstro-web-client monstro-web-admin monstro-widget; do
    systemctl enable "${unit}" 2>/dev/null || true
  done
}

sync_systemd_units "${1:?INSTALL_DIR required}"
