#!/usr/bin/env bash
# Сборка публичного сайта в staging и атомарная подмена .next (без 502)
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/monstro_chat_ai}"
# shellcheck source=lib/deploy-common.sh
source "${INSTALL_DIR}/scripts/lib/deploy-common.sh"

cd "${INSTALL_DIR}"
deploy_export_frontend_env

deploy_npm_install site \
  --workspace=@ai-consultant/shared-types \
  --workspace=@ai-consultant/public-site

deploy_log "Сборка публичного сайта (staging)..."
if [[ "${DEPLOY_SHARED_TYPES_SKIP:-0}" != "1" ]]; then
  npm run build -w @ai-consultant/shared-types
fi

deploy_prepare_staging_next >/dev/null
NEXT_STAGING_ABS="$(deploy_staging_next_dir)"
NEXT_DIST_REL="$(deploy_staging_next_dist_rel)"

deploy_log "Next.js distDir (relative): ${NEXT_DIST_REL}"
NEXT_DIST_DIR="${NEXT_DIST_REL}" NODE_ENV=production npm run build -w @ai-consultant/public-site

if [[ ! -d "${NEXT_STAGING_ABS}" ]]; then
  deploy_fail "Next.js build не создал staging .next: ${NEXT_STAGING_ABS}"
fi

deploy_atomic_swap_next

if ! deploy_ensure_service monstro-public-site; then
  deploy_warn "monstro-public-site unit отсутствует — start-public-site.sh"
  export DEPLOY_NPM_SKIP=1
  export DEPLOY_SHARED_TYPES_SKIP=1
  SKIP_SITE_BUILD=1 bash "${INSTALL_DIR}/scripts/start-public-site.sh"
fi
