#!/usr/bin/env bash
# Деплой конкретной ветки (до merge в main, когда GHCR-образа ещё нет)
#
# Usage:
#   sudo BRANCH=cursor/sprint-65-widget-stability-ab3a bash scripts/deploy-branch.sh
#   sudo BRANCH=cursor/sprint-65-widget-stability-ab3a bash scripts/deploy-branch.sh --widget
#
# API_USE_GHCR=0 — всегда локальная сборка API (образ в GHCR только для main)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/resolve-install-dir.sh
source "${SCRIPT_DIR}/lib/resolve-install-dir.sh"
BRANCH="${BRANCH:?Укажите ветку: BRANCH=cursor/... sudo bash scripts/deploy-branch.sh}"

export BRANCH
export API_USE_GHCR=0
export DO_PULL=1

exec bash "${INSTALL_DIR}/scripts/fast-update.sh" --full "$@"
