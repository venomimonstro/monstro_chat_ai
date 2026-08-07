#!/usr/bin/env bash
# Принудительный деплой main с восстановлением зависимостей и сервисов
# Usage: sudo bash scripts/force-deploy-main.sh
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/monstro_chat_ai}"
cd "${INSTALL_DIR}"

# shellcheck source=lib/deploy-common.sh
source "${INSTALL_DIR}/scripts/lib/deploy-common.sh"

[[ "${EUID:-$(id -u)}" -eq 0 ]] || deploy_fail "Запустите от root: sudo bash scripts/force-deploy-main.sh"

deploy_log "Принудительный деплой main..."

git fetch origin || deploy_fail "git fetch не удался"
git checkout main || deploy_fail "git checkout main не удался"
git reset --hard origin/main || deploy_fail "git reset --hard не удался"

deploy_log "Ветка: $(git log -1 --oneline)"

bash "${INSTALL_DIR}/scripts/fix-npm-install.sh" || deploy_fail "fix-npm-install.sh не удался"
bash "${INSTALL_DIR}/scripts/fast-update.sh" --full --no-pull || deploy_fail "fast-update.sh не удался"

bash "${INSTALL_DIR}/scripts/aicw-diagnose-install.sh" 2>/dev/null || deploy_warn "Не удалось установить диагностический агент"

echo ""
echo "=============================================="
echo "  DEPLOY MAIN OK"
echo "  Отчёт: ${INSTALL_DIR}/.deploy/diagnose-report.json"
echo "=============================================="
