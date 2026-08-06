#!/usr/bin/env bash
# Самый быстрый путь: git pull + только изменённые компоненты
# Usage: sudo bash scripts/quick-update.sh [--widget|--site|...]
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/resolve-install-dir.sh
source "${SCRIPT_DIR}/lib/resolve-install-dir.sh"
exec bash "${INSTALL_DIR}/scripts/fast-update.sh" --auto "$@"
