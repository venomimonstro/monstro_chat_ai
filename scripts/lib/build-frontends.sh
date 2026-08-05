#!/usr/bin/env bash
# Сборка ЛК + админки и перезапуск systemd
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/resolve-install-dir.sh
source "${SCRIPT_DIR}/resolve-install-dir.sh"
# shellcheck source=lib/deploy-common.sh
source "${INSTALL_DIR}/scripts/lib/deploy-common.sh"

cd "${INSTALL_DIR}"
deploy_export_frontend_env

if [[ "${DEPLOY_SKIP_NPM_INSTALL:-0}" != "1" ]]; then
  deploy_npm_install frontends \
    --workspace=@ai-consultant/shared-types \
    --workspace=@ai-consultant/web-client \
    --workspace=@ai-consultant/web-admin
fi

deploy_log "Сборка ЛК и админки..."
npm run build -w @ai-consultant/shared-types
npm run build -w @ai-consultant/web-client
npm run build -w @ai-consultant/web-admin

deploy_restart_if_active monstro-web-client || true
deploy_restart_if_active monstro-web-admin || {
  deploy_warn "Фронтенд-сервисы не найдены — start-frontend.sh"
  bash "${INSTALL_DIR}/scripts/start-frontend.sh"
}
