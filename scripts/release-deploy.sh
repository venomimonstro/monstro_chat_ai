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
FORCE_DEPLOY="${FORCE_DEPLOY:-}"

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

build_manifest_json() {
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
    "deployedAt": datetime.datetime.now(datetime.UTC).isoformat().replace("+00:00", "Z"),
}
print(json.dumps(data))
PY
}

save_manifest() {
  local manifest_json="$1"
  python3 - <<PY
import json, os
data = json.loads('''${manifest_json}''')
path = os.path.join("${INSTALL_DIR}", "releases", "manifest.json")
os.makedirs(os.path.dirname(path), exist_ok=True)
with open(path, "w") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
print(json.dumps(data))
PY
}

sync_manifest_to_api() {
  local manifest_json="$1"
  if [[ -z "${RELEASE_DEPLOY_TOKEN}" ]]; then
    warn "RELEASE_DEPLOY_TOKEN не задан — версия в API не обновлена до проверки"
    return 0
  fi
  curl -sf -X POST "${API_BASE}/admin/release/sync" \
    -H "Content-Type: application/json" \
    -H "X-Release-Token: ${RELEASE_DEPLOY_TOKEN}" \
    -d "${manifest_json}" >/dev/null 2>&1 || warn "Не удалось синхронизировать manifest в API"
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

  local running_version
  running_version=$(current_api_version)
  if [[ -n "${running_version}" && "${FORCE_DEPLOY}" != "1" ]]; then
    if [[ "$(version_gt "${running_version}" "${VERSION}")" == "yes" ]]; then
      fail "На сервере уже версия ${running_version}. Нельзя откатить код командой release-deploy.sh ${VERSION} ${SPRINT}. Используйте актуальную версию (например 0.33.0 33) или FORCE_DEPLOY=1 для принудительного выката."
    fi
  fi

  # Pre-deploy: сервис жив (старая версия допустима)
  log "Pre-deploy проверка..."
  bash "${INSTALL_DIR}/scripts/verify-release.sh" pre || fail "Pre-deploy: API/DB/Redis недоступны"

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

  # Синхронизируем версию в API до post-verify (health читает manifest из Redis)
  PENDING_MANIFEST=$(build_manifest_json)
  log "Синхронизация версии ${VERSION} в API перед проверкой..."
  sync_manifest_to_api "${PENDING_MANIFEST}"

  # Post-deploy verification
  log "Post-deploy проверка..."
  if ! bash "${INSTALL_DIR}/scripts/verify-release.sh" post "${VERSION}" "${SPRINT}"; then
    rollback_on_failure
  fi

  # Сохраняем manifest на диск только после успешной проверки
  MANIFEST_JSON=$(save_manifest "${PENDING_MANIFEST}")
  log "Manifest: ${MANIFEST_JSON}"

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
