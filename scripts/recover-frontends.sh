#!/usr/bin/env bash
# Срочное восстановление при nginx 502 (фронт-сервисы down после npm/деплоя)
# Для полного восстановления используйте: sudo bash scripts/emergency-recover-502.sh
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/monstro_chat_ai}"
exec bash "${INSTALL_DIR}/scripts/emergency-recover-502.sh" "$@"
