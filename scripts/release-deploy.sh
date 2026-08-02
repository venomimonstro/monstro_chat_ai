#!/usr/bin/env bash
# Деплой версии с проверками и авто-откатом при ошибке
# Usage: sudo RELEASE_UPDATE_ID=<uuid> bash scripts/release-deploy.sh <version> <sprint>
set -euo pipefail

VERSION="${1:?Usage: release-deploy.sh <version> <sprint>}"
SPRINT="${2:?Usage: release-deploy.sh <version> <sprint>}"
INSTALL_DIR="${INSTALL_DIR:-/opt/monstro_chat_ai}"
API_BASE="${API_BASE:-http://127.0.0.1:3000/api}"
RELEASE_UPDATE_ID="${RELEASE_UPDATE_ID:-}"
RELEASE_DEPLOY_TOKEN="${RELEASE_DEPLOY_TOKEN:-}"

log()  { echo -e "\n\033[1;32m==>\033[0m $*"; }
warn() { echo -e "\033[1;33m!!\033[0m $*"; }
fail() { echo -e "\033[1;31mERROR:\033[0m $*" >&2; exit 1; }

report() {
  local phase="$1" level="$2" message="$3"
  echo "[${level}] ${message}"
  if [[ -n "${RELEASE_UPDATE_ID}" && -n "${RELEASE_DEPLOY_TOKEN}" ]]; then
    curl -sf -X POST "${API_BASE}/admin/release/report" \
      -H "Content-Type: application/json" \
      -H "X-Release-Token: ${RELEASE_DEPLOY_TOKEN}" \
      -d "{\"updateId\":\"${RELEASE_UPDATE_ID}\",\"phase\":\"${phase}\",\"level\":\"${level}\",\"message\":$(python3 -c "import json; print(json.dumps('${message//\'/\\\'}'))")}" \
      >/dev/null 2>&1 || true
  fi
}

read_manifest() {
  python3 -c "
import json, os
p = os.path.join('${INSTALL_DIR}', 'releases', 'manifest.json')
if os.path.isfile(p):
    print(json.dumps(json.load(open(p))))
else:
    print('{}')
" 2>/dev/null || echo '{}'
}

save_manifest() {
  local git_sha
  git_sha=$(cd "${INSTALL_DIR}" && git rev-parse --short HEAD 2>/dev/null || echo "")
  python3 - <<PY
import json, datetime, os
path = os.path.join("${INSTALL_DIR}", "releases", "manifest.json")
prev = {}
if os.path.isfile(path):
    with open(path) as f:
        prev = json.load(f)
data = {
    "version": "${VERSION}",
    "sprint": int("${SPRINT}"),
    "name": prev.get("name", "Release ${VERSION}"),
    "gitSha": "${git_sha}",
    "previousVersion": prev.get("version", "${VERSION}"),
    "previousSprint": prev.get("sprint", int("${SPRINT}")),
    "deployedAt": datetime.datetime.utcnow().isoformat() + "Z",
}
os.makedirs(os.path.dirname(path), exist_ok=True)
with open(path, "w") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
print(json.dumps(data))
PY
}

rollback_on_failure() {
  warn "Деплой не прошёл проверки — запускаю откат..."
  report "deploy" "error" "Авто-откат из-за ошибки деплоя"
  if [[ -f "${INSTALL_DIR}/scripts/release-rollback.sh" ]]; then
    bash "${INSTALL_DIR}/scripts/release-rollback.sh" || true
  fi
  if [[ -n "${RELEASE_UPDATE_ID}" && -n "${RELEASE_DEPLOY_TOKEN}" ]]; then
    curl -sf -X POST "${API_BASE}/admin/release/complete" \
      -H "Content-Type: application/json" \
      -H "X-Release-Token: ${RELEASE_DEPLOY_TOKEN}" \
      -d "{\"updateId\":\"${RELEASE_UPDATE_ID}\",\"version\":\"${VERSION}\",\"sprint\":${SPRINT},\"success\":false}" \
      >/dev/null 2>&1 || true
  fi
  fail "Деплой отменён, выполнен откат"
}

main() {
  [[ "${EUID:-$(id -u)}" -eq 0 ]] || fail "Запустите от root"

  log "Деплой версии ${VERSION} (Sprint ${SPRINT})"
  report "deploy" "info" "Старт деплоя ${VERSION} (Sprint ${SPRINT})"

  # Pre-deploy: текущий сервис должен быть жив
  log "Pre-deploy проверка..."
  bash "${INSTALL_DIR}/scripts/verify-release.sh" || fail "Pre-deploy: сервис в нерабочем состоянии"

  # Deploy
  export APP_VERSION="${VERSION}"
  export SPRINT_NUMBER="${SPRINT}"
  if [[ -f "${INSTALL_DIR}/scripts/remote-update.sh" ]]; then
  report "deploy" "info" "Запуск remote-update.sh"
    bash "${INSTALL_DIR}/scripts/remote-update.sh"
  else
    report "deploy" "info" "Запуск deploy-update.sh"
    bash "${INSTALL_DIR}/scripts/deploy-update.sh"
  fi

  # Update manifest on disk
  MANIFEST_JSON=$(save_manifest)
  log "Manifest: ${MANIFEST_JSON}"

  # Post-deploy verification
  log "Post-deploy проверка..."
  if ! bash "${INSTALL_DIR}/scripts/verify-release.sh" "${VERSION}" "${SPRINT}"; then
    rollback_on_failure
  fi

  # Sync to API
  if [[ -n "${RELEASE_DEPLOY_TOKEN}" ]]; then
    curl -sf -X POST "${API_BASE}/admin/release/sync" \
      -H "Content-Type: application/json" \
      -H "X-Release-Token: ${RELEASE_DEPLOY_TOKEN}" \
      -d "${MANIFEST_JSON}" >/dev/null 2>&1 || warn "Не удалось синхронизировать manifest в API"
  fi

  if [[ -n "${RELEASE_UPDATE_ID}" && -n "${RELEASE_DEPLOY_TOKEN}" ]]; then
    curl -sf -X POST "${API_BASE}/admin/release/complete" \
      -H "Content-Type: application/json" \
      -H "X-Release-Token: ${RELEASE_DEPLOY_TOKEN}" \
      -d "{\"updateId\":\"${RELEASE_UPDATE_ID}\",\"version\":\"${VERSION}\",\"sprint\":${SPRINT},\"success\":true}" \
      >/dev/null 2>&1 || warn "Не удалось отметить обновление в админке"
  fi

  report "deploy" "info" "Деплой ${VERSION} успешно завершён"
  log "Деплой ${VERSION} (Sprint ${SPRINT}) завершён успешно"
}

main "$@"
