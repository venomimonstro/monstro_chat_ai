#!/usr/bin/env bash
# Восстановление node_modules когда tsc/typescript пропал (частая причина падения сборки)
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/monstro_chat_ai}"
cd "${INSTALL_DIR}"

# shellcheck source=lib/deploy-common.sh
source "${INSTALL_DIR}/scripts/lib/deploy-common.sh"

deploy_log "Проверка node_modules..."
if deploy_npm_deps_healthy; then
  deploy_log "typescript/tsc на месте — ничего делать не нужно"
  bash "${INSTALL_DIR}/scripts/lib/npm-fix-bins.sh"
  node "${INSTALL_DIR}/node_modules/typescript/lib/tsc.js" --version
  exit 0
fi

deploy_warn "typescript не найден — полная переустановка зависимостей"
deploy_setup_npm_cache

if [[ -f package-lock.json ]]; then
  npm ci --include-workspace-root || npm install --include-workspace-root
else
  npm install --include-workspace-root
fi

bash "${INSTALL_DIR}/scripts/lib/npm-fix-bins.sh"

if ! deploy_npm_deps_healthy; then
  deploy_fail "После npm install typescript всё ещё отсутствует"
fi

deploy_log "OK: node ${INSTALL_DIR}/node_modules/typescript/lib/tsc.js --version"
node "${INSTALL_DIR}/node_modules/typescript/lib/tsc.js" --version
echo ""
echo "Теперь повторите деплой:"
echo "  sudo bash scripts/fast-update.sh --full --no-pull"
