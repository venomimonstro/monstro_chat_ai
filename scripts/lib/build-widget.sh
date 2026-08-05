#!/usr/bin/env bash
# Сборка и перезапуск только виджета (без systemd unit recreate)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/resolve-install-dir.sh
source "${SCRIPT_DIR}/resolve-install-dir.sh"
# shellcheck source=lib/deploy-common.sh
source "${INSTALL_DIR}/scripts/lib/deploy-common.sh"

cd "${INSTALL_DIR}"

deploy_npm_install widget \
  --workspace=@ai-consultant/shared-types \
  --workspace=@ai-consultant/widget

deploy_log "Сборка виджета..."
npm run build -w @ai-consultant/shared-types
npm run build -w @ai-consultant/widget

if ! deploy_restart_if_active monstro-widget; then
  deploy_warn "monstro-widget не запущен — запускаю start-widget.sh"
  bash "${INSTALL_DIR}/scripts/start-widget.sh"
fi
