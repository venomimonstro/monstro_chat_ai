#!/usr/bin/env bash
# Сборка публичного сайта и перезапуск systemd
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/monstro_chat_ai}"
# shellcheck source=lib/deploy-common.sh
source "${INSTALL_DIR}/scripts/lib/deploy-common.sh"

cd "${INSTALL_DIR}"
deploy_export_frontend_env

deploy_npm_install site \
  --workspace=@ai-consultant/shared-types \
  --workspace=@ai-consultant/public-site

deploy_log "Сборка публичного сайта..."
if [[ "${DEPLOY_SHARED_TYPES_SKIP:-0}" != "1" ]]; then
  npm run build -w @ai-consultant/shared-types
fi
npm run build -w @ai-consultant/public-site

deploy_restart_if_active monstro-public-site || {
  deploy_warn "monstro-public-site не запущен — start-public-site.sh"
  bash "${INSTALL_DIR}/scripts/start-public-site.sh"
}
