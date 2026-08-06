#!/usr/bin/env bash
# Shared helpers for release scripts
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/resolve-install-dir.sh
source "${SCRIPT_DIR}/resolve-install-dir.sh"
API_BASE="${API_BASE:-http://127.0.0.1:3000/api}"

load_deploy_token() {
  if [[ -n "${RELEASE_DEPLOY_TOKEN:-}" ]]; then
    return 0
  fi
  local env_file="${INSTALL_DIR}/.env"
  if [[ -f "${env_file}" ]]; then
    RELEASE_DEPLOY_TOKEN=$(grep -E '^RELEASE_DEPLOY_TOKEN=' "${env_file}" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
    export RELEASE_DEPLOY_TOKEN
  fi
}

parse_version_tuple() {
  python3 -c "
parts = '$1'.split('.')
nums = [int(p) for p in parts[:3] if p.isdigit()]
while len(nums) < 3:
    nums.append(0)
print(tuple(nums))
"
}

version_gt() {
  python3 -c "
def parse(v):
    parts = v.split('.')
    return tuple(int(p) for p in parts[:3] if p.isdigit())
try:
    print('yes' if parse('$1') > parse('$2') else 'no')
except Exception:
    print('no')
" 2>/dev/null || echo "no"
}

current_api_version() {
  curl -sf "${API_BASE}/health" 2>/dev/null | python3 -c "
import sys, json
try:
    print(json.load(sys.stdin).get('version', ''))
except Exception:
    print('')
" 2>/dev/null || echo ""
}

container_app_version() {
  docker exec aicw-api printenv APP_VERSION 2>/dev/null || echo ""
}

container_sprint_number() {
  docker exec aicw-api printenv SPRINT_NUMBER 2>/dev/null || echo ""
}

read_latest_done_sprint() {
  python3 - <<'PY'
import os, re
path = os.path.join(os.environ.get("INSTALL_DIR", "/opt/redflow"), "docs", "SPRINTS.md")
if not os.path.isfile(path):
    raise SystemExit("SPRINTS.md not found")
latest = None
for line in open(path, encoding="utf-8"):
    m = re.match(r"^\|\s*(\d+)\s*\|\s*Done\s*\|", line)
    if m:
        latest = int(m.group(1))
if latest is None:
    raise SystemExit("No Done sprint in SPRINTS.md")
print(f"0.{latest}.0 {latest}")
PY
}
