#!/usr/bin/env bash
# Восстановление последней успешной версии (dist + API + git) без 502
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/monstro_chat_ai}"
# shellcheck source=lib/deploy-common.sh
source "${INSTALL_DIR}/scripts/lib/deploy-common.sh"
# shellcheck source=lib/deploy-checkpoint.sh
source "${INSTALL_DIR}/scripts/lib/deploy-checkpoint.sh"

[[ "${EUID:-$(id -u)}" -eq 0 ]] || deploy_fail "Запустите от root: sudo bash scripts/recover-last-good.sh"

deploy_log "Восстановление last-good..."
deploy_restore_last_good

ip="$(deploy_detect_ip)"
echo ""
echo "=============================================="
echo "  LAST-GOOD RESTORE OK"
echo "=============================================="
echo "  API:    http://${ip}:3000/api/health"
echo "  Виджет: http://${ip}:5175/embed.js"
echo "  Сайт:   http://${ip}:4321"
echo ""
