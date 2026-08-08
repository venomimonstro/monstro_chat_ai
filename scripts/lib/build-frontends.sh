#!/usr/bin/env bash
# Сборка ЛК + админки и перезапуск systemd
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

deploy_log "Сборка ЛК и админки..."
if [[ "${DEPLOY_SHARED_TYPES_SKIP:-0}" != "1" ]]; then
  npm run build -w @ai-consultant/shared-types
fi

# ЛК на /app/ (production domain)
VITE_BASE_PATH="${VITE_CLIENT_BASE_PATH:-/app/}" VITE_API_URL="${VITE_API_URL}" \
  npm run build -w @ai-consultant/web-client

# Админка на /admin/ (production domain)
VITE_BASE_PATH="${VITE_ADMIN_BASE_PATH:-/admin/}" VITE_API_URL="${VITE_API_URL}" \
  npm run build -w @ai-consultant/web-admin

deploy_verify_spa_assets || deploy_fail "SPA dist собран без корректного VITE_BASE_PATH"

# Важно: после stop сервисов is-active=false — нужен start, не «restart if active»
if ! deploy_ensure_service monstro-web-client || ! deploy_ensure_service monstro-web-admin; then
  deploy_warn "Unit'ы фронтенда отсутствуют — создаю через start-frontend.sh"
  # Не даём start-frontend снова гонять npm/build: SKIP_* уже выставлены из prepare
  export DEPLOY_NPM_SKIP=1
  export DEPLOY_SHARED_TYPES_SKIP=1
  SKIP_FRONTEND_BUILD=1 bash "${INSTALL_DIR}/scripts/start-frontend.sh"
fi
