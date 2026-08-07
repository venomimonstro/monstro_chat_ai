#!/usr/bin/env bash
# Установка диагностического агента как systemd unit + timer
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/monstro_chat_ai}"
SERVICE="aicw-diagnose"
TIMER="aicw-diagnose"

cat > "/etc/systemd/system/${SERVICE}.service" << EOF
[Unit]
Description=AICW Deploy Diagnostic Agent
After=network.target

[Service]
Type=oneshot
ExecStart=/usr/bin/env bash ${INSTALL_DIR}/scripts/aicw-diagnose.sh
WorkingDirectory=${INSTALL_DIR}
StandardOutput=journal
StandardError=journal
EOF

cat > "/etc/systemd/system/${TIMER}.timer" << EOF
[Unit]
Description=Run AICW diagnostic every 5 minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now "${TIMER}.timer"
systemctl start "${SERVICE}.service" || true

echo "Диагностический агент установлен."
echo "  Отчёт:    ${INSTALL_DIR}/.deploy/diagnose-report.json"
echo "  Лог:      ${INSTALL_DIR}/.deploy/diagnose.log"
echo "  Статус:   systemctl status ${TIMER}.timer"
echo "  Запуск:   systemctl start ${SERVICE}.service"
