#!/usr/bin/env bash
# Сборка публичного сайта и перезапуск systemd
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/monstro_chat_ai}"
# shellcheck source=lib/deploy-common.sh
source "${INSTALL_DIR}/scripts/lib/deploy-common.sh"

cd "${INSTALL_DIR}"
deploy_export_frontend_env

if [[ "${DEPLOY_SKIP_NPM_INSTALL:-0}" != "1" ]]; then
  deploy_npm_install site \
    --workspace=@ai-consultant/shared-types \
    --workspace=@ai-consultant/public-site
fi

deploy_log "Сборка публичного сайта..."
npm run build -w @ai-consultant/shared-types
npm run build -w @ai-consultant/public-site

deploy_restart_if_active monstro-public-site || {
  deploy_warn "monstro-public-site не запущен — start-public-site.sh"
  bash "${INSTALL_DIR}/scripts/start-public-site.sh"
}
