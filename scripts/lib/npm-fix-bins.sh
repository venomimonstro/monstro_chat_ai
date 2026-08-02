#!/usr/bin/env bash
# npm on some VPS/filesystems creates node_modules/.bin without +x — fix before builds
set -euo pipefail

INSTALL_DIR="${1:-${INSTALL_DIR:-/opt/monstro_chat_ai}}"

if [[ -d "${INSTALL_DIR}/node_modules/.bin" ]]; then
  chmod -R u+x "${INSTALL_DIR}/node_modules/.bin" 2>/dev/null || true
fi

if [[ -f "${INSTALL_DIR}/node_modules/typescript/bin/tsc" ]]; then
  chmod u+x "${INSTALL_DIR}/node_modules/typescript/bin/tsc" 2>/dev/null || true
fi

for bin_dir in \
  "${INSTALL_DIR}/packages/shared-types/node_modules/.bin" \
  "${INSTALL_DIR}/apps/widget/node_modules/.bin" \
  "${INSTALL_DIR}/apps/web-client/node_modules/.bin" \
  "${INSTALL_DIR}/apps/web-admin/node_modules/.bin" \
  "${INSTALL_DIR}/apps/public-site/node_modules/.bin"; do
  if [[ -d "${bin_dir}" ]]; then
    chmod -R u+x "${bin_dir}" 2>/dev/null || true
  fi
done
