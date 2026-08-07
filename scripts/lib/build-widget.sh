#!/usr/bin/env bash
# Сборка и перезапуск только виджета (без systemd unit recreate)
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/monstro_chat_ai}"
# shellcheck source=lib/deploy-common.sh
source "${INSTALL_DIR}/scripts/lib/deploy-common.sh"

cd "${INSTALL_DIR}"

deploy_npm_install widget \
  --workspace=@ai-consultant/shared-types \
  --workspace=@ai-consultant/widget

deploy_log "Сборка виджета..."
if [[ "${DEPLOY_SHARED_TYPES_SKIP:-0}" != "1" ]]; then
  npm run build -w @ai-consultant/shared-types
fi
npm run build -w @ai-consultant/widget

if ! deploy_ensure_service monstro-widget; then
  deploy_warn "monstro-widget unit отсутствует — start-widget.sh"
  export DEPLOY_NPM_SKIP=1
  export DEPLOY_SHARED_TYPES_SKIP=1
  SKIP_WIDGET_BUILD=1 bash "${INSTALL_DIR}/scripts/start-widget.sh"
fi
