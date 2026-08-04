#!/usr/bin/env bash
# Самый быстрый путь: git pull + только изменённые компоненты
# Usage: sudo bash scripts/quick-update.sh [--widget|--site|...]
set -euo pipefail
INSTALL_DIR="${INSTALL_DIR:-/opt/monstro_chat_ai}"
exec bash "${INSTALL_DIR}/scripts/fast-update.sh" --auto "$@"
