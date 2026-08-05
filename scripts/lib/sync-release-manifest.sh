#!/usr/bin/env bash
# Синхронизация manifest/API после деплоя (fast-update, release-deploy)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=resolve-install-dir.sh
source "${SCRIPT_DIR}/resolve-install-dir.sh"

API_BASE="${API_BASE:-http://127.0.0.1:3000/api}"
# shellcheck source=release-version.sh
source "${INSTALL_DIR}/scripts/lib/release-version.sh"

load_deploy_token

if [[ -z "${RELEASE_DEPLOY_TOKEN:-}" ]]; then
  echo "!! RELEASE_DEPLOY_TOKEN не задан — пропуск sync manifest" >&2
  exit 0
fi

read -r VERSION SPRINT <<< "$(read_latest_done_sprint)"
GIT_SHA="$(git -C "${INSTALL_DIR}" rev-parse HEAD 2>/dev/null || echo "")"

PREV_VERSION="$(curl -sf "${API_BASE}/admin/release/current" \
  -H "Authorization: Bearer skip" 2>/dev/null | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('version',''))
except Exception:
    print('')
" 2>/dev/null || echo "")"

# Public endpoint needs token only on POST sync — read previous from local manifest
if [[ -f "${INSTALL_DIR}/releases/manifest.json" ]]; then
  PREV_VERSION="$(python3 -c "
import json, os
p = os.path.join('${INSTALL_DIR}', 'releases', 'manifest.json')
d = json.load(open(p))
print(d.get('version',''))
" 2>/dev/null || echo "${PREV_VERSION}")"
fi

PAYLOAD=$(python3 - <<PY
import json
print(json.dumps({
  "version": "${VERSION}",
  "sprint": int("${SPRINT}"),
  "gitSha": "${GIT_SHA}" or None,
  "previousVersion": "${PREV_VERSION}" or None,
  "name": "RedFlow",
  "deployedAt": __import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat().replace('+00:00','Z'),
}))
PY
)

curl -sf -X POST "${API_BASE}/admin/release/sync" \
  -H "Content-Type: application/json" \
  -H "x-release-token: ${RELEASE_DEPLOY_TOKEN}" \
  -d "${PAYLOAD}" >/dev/null

echo "Release manifest synced: v${VERSION} sprint ${SPRINT}"
