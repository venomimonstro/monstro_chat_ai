#!/usr/bin/env bash
# Включает автозапуск Docker, systemd-сервисов Monstro и cron-watchdog после reboot.
# Usage: sudo bash scripts/ensure-boot-stability.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/resolve-install-dir.sh
source "${SCRIPT_DIR}/lib/resolve-install-dir.sh"
WATCHDOG_CRON="*/2 * * * * root ${INSTALL_DIR}/scripts/health-watchdog.sh >> /var/log/aicw-watchdog.log 2>&1"
CRON_FILE="/etc/cron.d/aicw-watchdog"

log()  { echo -e "\033[1;32m==>\033[0m $*"; }
warn() { echo -e "\033[1;33m!!\033[0m $*"; }

require_root() {
  [[ "${EUID:-$(id -u)}" -eq 0 ]] || {
    echo "Запустите от root: sudo bash scripts/ensure-boot-stability.sh" >&2
    exit 1
  }
}

enable_docker() {
  if command -v systemctl >/dev/null 2>&1; then
    log "Docker: enable + start"
    systemctl enable docker 2>/dev/null || true
    systemctl start docker 2>/dev/null || true
  fi
}

install_boot_unit() {
  local unit="/etc/systemd/system/monstro-boot-recovery.service"
  log "Создаю ${unit}"
  cat > "${unit}" << EOF
[Unit]
Description=Monstro Chat AI — восстановление стека после reboot
After=network-online.target docker.service
Wants=network-online.target docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${INSTALL_DIR}
ExecStart=/bin/bash ${INSTALL_DIR}/scripts/boot-recovery.sh
TimeoutStartSec=600

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable monstro-boot-recovery.service
}

enable_monstro_units() {
  local units=(
    monstro-widget
    monstro-web-client
    monstro-web-admin
    monstro-public-site
  )
  for unit in "${units[@]}"; do
    if systemctl list-unit-files "${unit}.service" 2>/dev/null | grep -q "${unit}.service"; then
      log "systemd enable ${unit}"
      systemctl enable "${unit}" 2>/dev/null || true
    fi
  done
}

install_watchdog_cron() {
  log "Cron watchdog → ${CRON_FILE}"
  cat > "${CRON_FILE}" << EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
${WATCHDOG_CRON}
EOF
  chmod 644 "${CRON_FILE}"
  touch /var/log/aicw-watchdog.log 2>/dev/null || true
  chmod 644 /var/log/aicw-watchdog.log 2>/dev/null || true
}

ensure_docker_stack() {
  if [[ -d "${INSTALL_DIR}" && -f "${INSTALL_DIR}/docker-compose.yml" ]]; then
    log "Docker compose up -d (postgres, redis, minio, api)"
    cd "${INSTALL_DIR}"
    docker compose up -d postgres redis minio api 2>/dev/null || true
  else
    warn "Репозиторий не найден в ${INSTALL_DIR} — пропускаю docker compose"
  fi
}

install_deploy_agent_cron() {
  local cron_file="/etc/cron.d/aicw-deploy-agent"
  log "Cron deploy-agent → ${cron_file}"
  cat > "${cron_file}" << EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
* * * * * root ${INSTALL_DIR}/scripts/host-deploy-agent.sh >> /var/log/aicw-deploy-agent.log 2>&1
EOF
  chmod 644 "${cron_file}"
  touch /var/log/aicw-deploy-agent.log 2>/dev/null || true
  chmod 644 /var/log/aicw-deploy-agent.log 2>/dev/null || true
}

main() {
  require_root
  log "Monstro — ensure boot stability"
  enable_docker
  install_boot_unit
  enable_monstro_units
  install_watchdog_cron
  install_deploy_agent_cron
  ensure_docker_stack
  log "Готово. После reboot: boot-recovery, watchdog (2 мин), deploy-agent (1 мин)."
}

main "$@"
