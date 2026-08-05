#!/usr/bin/env bash
# Восстановление после битого node_modules / ETXTBSY / ENOTEMPTY
# Usage: sudo bash scripts/fix-npm-install.sh
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/monstro_chat_ai}"
[[ "${EUID:-$(id -u)}" -eq 0 ]] || {
  echo "Запустите от root: sudo bash scripts/fix-npm-install.sh" >&2
  exit 1
}

exec bash "${INSTALL_DIR}/scripts/lib/npm-clean-install.sh"
