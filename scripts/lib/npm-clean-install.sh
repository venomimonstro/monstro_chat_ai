#!/usr/bin/env bash
# Полная переустановка npm-зависимостей (битый node_modules, ETXTBSY, ENOTEMPTY)
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/monstro_chat_ai}"
# shellcheck source=lib/deploy-common.sh
source "${INSTALL_DIR}/scripts/lib/deploy-common.sh"

deploy_log "Чистая переустановка npm-зависимостей..."
NPM_FORCE_CLEAN=1 deploy_npm_install all \
  --workspace=@ai-consultant/shared-types \
  --workspace=@ai-consultant/widget \
  --workspace=@ai-consultant/web-client \
  --workspace=@ai-consultant/web-admin \
  --workspace=@ai-consultant/public-site

deploy_log "Проверка установки..."
deploy_verify_npm_deps || deploy_fail "Зависимости установлены некорректно"

echo ""
echo "OK. Запустите: sudo bash scripts/fast-update.sh --full --no-pull"
