#!/usr/bin/env bash
# Полный деплой Sprint 70 на VPS одной командой
# Usage: sudo bash scripts/deploy-sprint-70.sh
#
# Делает: git pull ветки → fix npm → build → SSL → .env → verify
set -euo pipefail

BRANCH="${BRANCH:-cursor/sprint-70-redflow-release-ab3a}"
DOMAIN="${DOMAIN:-redflow.ru}"
SKIP_SSL="${SKIP_SSL:-0}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/resolve-install-dir.sh
source "${SCRIPT_DIR}/lib/resolve-install-dir.sh"

log()  { echo -e "\n\033[1;34m==>\033[0m $*"; }
fail() { echo -e "\033[1;31mERROR:\033[0m $*" >&2; exit 1; }

[[ "${EUID:-$(id -u)}" -eq 0 ]] || fail "Запустите от root: sudo bash scripts/deploy-sprint-70.sh"

cd "${INSTALL_DIR}"

log "1/4 Git: ${BRANCH}"
git fetch origin
git checkout "${BRANCH}"
git reset --hard "origin/${BRANCH}"
log "Коммит: $(git log -1 --oneline)"

log "2/4 npm install (fix-npm-install)"
bash "${INSTALL_DIR}/scripts/fix-npm-install.sh"

log "3/4 Сборка и перезапуск (fast-update --full --no-pull)"
bash "${INSTALL_DIR}/scripts/fast-update.sh" --full --no-pull

if [[ "${SKIP_SSL}" != "1" ]]; then
  log "4/4 SSL + nginx + .env + проверка (${DOMAIN})"
  DOMAIN="${DOMAIN}" bash "${INSTALL_DIR}/scripts/setup-ssl-redflow.sh"
else
  log "4/4 .env + пересборка + проверка (SKIP_SSL=1)"
  bash "${INSTALL_DIR}/scripts/apply-redflow-env.sh"
  bash "${INSTALL_DIR}/scripts/fast-update.sh" --full --no-pull
  bash "${INSTALL_DIR}/scripts/verify-redflow.sh"
fi

echo ""
echo "Sprint 70 задеплоен. Админка: https://${DOMAIN}/admin/sprints"
