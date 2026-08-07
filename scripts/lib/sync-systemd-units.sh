#!/usr/bin/env bash
# systemd-юниты с EnvironmentFile=.env (домен redflow.ru из apply-redflow-env)
set -euo pipefail

sync_systemd_units() {
  local install_dir="${1:?INSTALL_DIR required}"
  local node_bin
  node_bin="$(command -v node)"
  local next_js="${install_dir}/node_modules/next/dist/bin/next"
  local spa_server="${install_dir}/scripts/serve-spa-dist.mjs"

  chmod +x "${spa_server}" 2>/dev/null || true

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
Description=RedFlow Web Client (SPA static)
After=network.target docker.service

[Service]
Type=simple
WorkingDirectory=${install_dir}
EnvironmentFile=-${install_dir}/.env
Environment=NODE_ENV=production
Environment=INSTALL_DIR=${install_dir}
Environment=SPA_APP=web-client
Environment=SPA_BASE=/app/
Environment=PORT=5173
Environment=HOST=0.0.0.0
ExecStart=${node_bin} ${spa_server}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

  cat > /etc/systemd/system/monstro-web-admin.service << EOF
[Unit]
Description=RedFlow Web Admin (SPA static)
After=network.target docker.service

[Service]
Type=simple
WorkingDirectory=${install_dir}
EnvironmentFile=-${install_dir}/.env
Environment=NODE_ENV=production
Environment=INSTALL_DIR=${install_dir}
Environment=SPA_APP=web-admin
Environment=SPA_BASE=/admin/
Environment=PORT=5174
Environment=HOST=0.0.0.0
ExecStart=${node_bin} ${spa_server}
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
ExecStart=${node_bin} ${install_dir}/apps/widget/scripts/serve-static.mjs
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
