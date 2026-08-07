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
# public-site использует NEXT_PUBLIC_* из .env через deploy_export_frontend_env
# Next.js build MUST use production mode (API .env often has NODE_ENV=development)
NODE_ENV=production npm run build -w @ai-consultant/public-site

if ! deploy_ensure_service monstro-public-site; then
  deploy_warn "monstro-public-site unit отсутствует — start-public-site.sh"
  export DEPLOY_NPM_SKIP=1
  export DEPLOY_SHARED_TYPES_SKIP=1
  SKIP_SITE_BUILD=1 bash "${INSTALL_DIR}/scripts/start-public-site.sh"
fi
