#!/usr/bin/env bash
# Восстановление node_modules: остановка сервисов, чистка, один npm ci
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/monstro_chat_ai}"
cd "${INSTALL_DIR}"

# shellcheck source=lib/deploy-common.sh
source "${INSTALL_DIR}/scripts/lib/deploy-common.sh"

deploy_log "fix-npm-install: восстановление зависимостей"

deploy_npm_acquire_lock
trap deploy_npm_release_lock EXIT

deploy_setup_npm_cache

if deploy_npm_deps_healthy; then
  deploy_log "typescript + esbuild на месте — проверка пройдена"
  bash "${INSTALL_DIR}/scripts/lib/npm-fix-bins.sh"
  node "${INSTALL_DIR}/node_modules/typescript/lib/tsc.js" --version
  deploy_npm_release_lock
  trap - EXIT
  exit 0
fi

deploy_warn "Зависимости повреждены — полная переустановка"
deploy_remove_node_modules

rm -f "${LOCK_STAMP_DIR}/deps.sha" 2>/dev/null || true

if [[ -f package-lock.json ]]; then
  npm ci --include-workspace-root
else
  npm install --include-workspace-root
fi

bash "${INSTALL_DIR}/scripts/lib/npm-fix-bins.sh"

if ! deploy_npm_deps_healthy; then
  deploy_fail "После npm ci typescript/esbuild всё ещё отсутствуют"
fi

deploy_log "OK:"
node "${INSTALL_DIR}/node_modules/typescript/lib/tsc.js" --version
"${INSTALL_DIR}/node_modules/esbuild/bin/esbuild" --version 2>/dev/null || true

deploy_npm_release_lock
trap - EXIT

echo ""
echo "Готово. Повторите деплой:"
echo "  sudo bash scripts/fast-update.sh --full --no-pull"
