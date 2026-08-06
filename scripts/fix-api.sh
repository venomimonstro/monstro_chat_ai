#!/usr/bin/env bash
# Быстрый подъём API (Docker)
# Usage: sudo bash scripts/fix-api.sh
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/resolve-install-dir.sh
source "${SCRIPT_DIR}/lib/resolve-install-dir.sh"
exec bash "${INSTALL_DIR}/scripts/lib/ensure-api.sh" "${INSTALL_DIR}"
