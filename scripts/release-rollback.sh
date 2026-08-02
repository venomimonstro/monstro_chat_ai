#!/usr/bin/env bash
# Откат на предыдущую версию
# Usage: sudo bash scripts/release-rollback.sh [version]
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/monstro_chat_ai}"
API_BASE="${API_BASE:-http://127.0.0.1:3000/api}"
RELEASE_DEPLOY_TOKEN="${RELEASE_DEPLOY_TOKEN:-}"
TARGET_VERSION="${1:-}"

log()  { echo -e "\n\033[1;32m==>\033[0m $*"; }
warn() { echo -e "\033[1;33m!!\033[0m $*"; }
fail() { echo -e "\033[1;31mERROR:\033[0m $*" >&2; exit 1; }

read_field() {
  local field="$1"
  python3 -c "
import json, os
p = os.path.join('${INSTALL_DIR}', 'releases', 'manifest.json')
d = json.load(open(p)) if os.path.isfile(p) else {}
print(d.get('${field}', ''))
"
}

main() {
  [[ "${EUID:-$(id -u)}" -eq 0 ]] || fail "Запустите от root"
  cd "${INSTALL_DIR}"

  local prev_version prev_sprint
  if [[ -z "${TARGET_VERSION}" ]]; then
    prev_version=$(read_field previousVersion)
    prev_sprint=$(read_field previousSprint)
  else
    prev_version="${TARGET_VERSION}"
    prev_sprint=""
  fi

  [[ -n "${prev_version}" ]] || fail "Предыдущая версия не найдена в releases/manifest.json"

  log "Откат на версию ${prev_version} (sprint ${prev_sprint:-?})"

  # Pre-rollback health
  bash "${INSTALL_DIR}/scripts/verify-release.sh" || warn "Pre-rollback: сервис уже деградировал"

  export APP_VERSION="${prev_version}"
  export SPRINT_NUMBER="${prev_sprint}"
  export BRANCH=main

  git fetch origin
  # Try to checkout tag, else stay on main and rebuild
  if git rev-parse "v${prev_version}" >/dev/null 2>&1; then
    git checkout "v${prev_version}"
  elif git rev-parse "${prev_version}" >/dev/null 2>&1; then
    git checkout "${prev_version}"
  else
    warn "Тег ${prev_version} не найден — пересборка текущего main"
    git checkout main
    git reset --hard origin/main
  fi

  bash "${INSTALL_DIR}/scripts/deploy-update.sh"

  # Swap current/previous in manifest
  python3 - <<PY
import json, datetime, os
path = os.path.join("${INSTALL_DIR}", "releases", "manifest.json")
d = json.load(open(path)) if os.path.isfile(path) else {}
current_v = d.get("version")
current_s = d.get("sprint")
d["version"] = "${prev_version}"
d["sprint"] = int("${prev_sprint}" or d.get("previousSprint", 0))
d["previousVersion"] = current_v or d.get("previousVersion")
d["previousSprint"] = current_s or d.get("previousSprint")
d["deployedAt"] = datetime.datetime.utcnow().isoformat() + "Z"
d["rolledBackAt"] = d["deployedAt"]
with open(path, "w") as f:
    json.dump(d, f, indent=2, ensure_ascii=False)
print(json.dumps(d))
PY

  bash "${INSTALL_DIR}/scripts/verify-release.sh" "${prev_version}" "${prev_sprint}" || \
    fail "Откат выполнен, но post-rollback проверка не прошла"

  if [[ -n "${RELEASE_DEPLOY_TOKEN}" ]]; then
    curl -sf -X POST "${API_BASE}/admin/release/sync" \
      -H "Content-Type: application/json" \
      -H "X-Release-Token: ${RELEASE_DEPLOY_TOKEN}" \
      -d @"${INSTALL_DIR}/releases/manifest.json" >/dev/null 2>&1 || true
  fi

  log "Откат на ${prev_version} завершён"
  echo ""
  echo "  Откат: sudo bash scripts/release-rollback.sh"
  echo "  Статус: curl ${API_BASE}/public/release"
}

main "$@"
