#!/usr/bin/env bash
# Деплой последнего завершённого спринта из docs/SPRINTS.md
# Usage: sudo bash scripts/deploy-latest.sh
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/monstro_chat_ai}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=lib/release-version.sh
source "${SCRIPT_DIR}/lib/release-version.sh"

log()  { echo -e "\n\033[1;32m==>\033[0m $*"; }
fail() { echo -e "\033[1;31mERROR:\033[0m $*" >&2; exit 1; }

main() {
  [[ "${EUID:-$(id -u)}" -eq 0 ]] || fail "Запустите от root: sudo bash scripts/deploy-latest.sh"

  cd "${INSTALL_DIR}"
  log "Обновляю код из main..."
  git fetch origin
  git checkout main
  git reset --hard origin/main

  read -r VERSION SPRINT < <(read_latest_done_sprint)
  log "Последний спринт в SPRINTS.md: Sprint ${SPRINT} → версия ${VERSION}"

  load_deploy_token
  bash "${SCRIPT_DIR}/release-deploy.sh" "${VERSION}" "${SPRINT}"
}

main "$@"
