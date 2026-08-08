#!/usr/bin/env bash
# Сборка ЛК + админки в staging и атомарная подмена dist (без 502)
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/monstro_chat_ai}"
# shellcheck source=lib/deploy-common.sh
source "${INSTALL_DIR}/scripts/lib/deploy-common.sh"

cd "${INSTALL_DIR}"
deploy_export_frontend_env

deploy_npm_install frontends \
  --workspace=@ai-consultant/shared-types \
  --workspace=@ai-consultant/web-client \
  --workspace=@ai-consultant/web-admin

deploy_log "Сборка ЛК и админки (staging)..."
if [[ "${DEPLOY_SHARED_TYPES_SKIP:-0}" != "1" ]]; then
  npm run build -w @ai-consultant/shared-types
fi

CLIENT_STAGING="$(deploy_prepare_staging_dist web-client)"
ADMIN_STAGING="$(deploy_prepare_staging_dist web-admin)"

VITE_BASE_PATH="${VITE_CLIENT_BASE_PATH:-/app/}" \
  VITE_API_URL="${VITE_API_URL}" \
  VITE_WIDGET_URL="${VITE_WIDGET_URL}" \
  VITE_WIDGET_SCRIPT_URL="${VITE_WIDGET_SCRIPT_URL}" \
  npm run build -w @ai-consultant/web-client -- --outDir "${CLIENT_STAGING}"

VITE_BASE_PATH="${VITE_ADMIN_BASE_PATH:-/admin/}" \
  VITE_API_URL="${VITE_API_URL}" \
  VITE_WIDGET_URL="${VITE_WIDGET_URL}" \
  npm run build -w @ai-consultant/web-admin -- --outDir "${ADMIN_STAGING}"

deploy_atomic_swap_dist web-client
deploy_atomic_swap_dist web-admin

deploy_verify_spa_assets || deploy_fail "SPA dist собран без корректного VITE_BASE_PATH"

if ! deploy_ensure_service monstro-web-client || ! deploy_ensure_service monstro-web-admin; then
  deploy_warn "Unit'ы фронтенда отсутствуют — создаю через start-frontend.sh"
  export DEPLOY_NPM_SKIP=1
  export DEPLOY_SHARED_TYPES_SKIP=1
  SKIP_FRONTEND_BUILD=1 bash "${INSTALL_DIR}/scripts/start-frontend.sh"
fi
