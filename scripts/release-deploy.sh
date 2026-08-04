#!/usr/bin/env bash
# Деплой версии с проверками
# Usage:
#   sudo bash scripts/release-deploy.sh <version> <sprint>
#   sudo bash scripts/deploy-latest.sh   # авто-версия из SPRINTS.md
set -euo pipefail

VERSION="${1:?Usage: release-deploy.sh <version> <sprint> OR deploy-latest.sh}"
SPRINT="${2:?Usage: release-deploy.sh <version> <sprint>}"
INSTALL_DIR="${INSTALL_DIR:-/opt/monstro_chat_ai}"
API_BASE="${API_BASE:-http://127.0.0.1:3000/api}"
RELEASE_UPDATE_ID="${RELEASE_UPDATE_ID:-}"
FORCE_DEPLOY="${FORCE_DEPLOY:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=lib/release-version.sh
source "${SCRIPT_DIR}/lib/release-version.sh"

log()  { echo -e "\n\033[1;32m==>\033[0m $*"; }
warn() { echo -e "\033[1;33m!!\033[0m $*"; }
fail() { echo -e "\033[1;31mERROR:\033[0m $*" >&2; exit 1; }

report() {
  local phase="$1" level="$2" message="$3"
  echo "[${level}] ${message}"
  load_deploy_token
  if [[ -n "${RELEASE_UPDATE_ID}" && -n "${RELEASE_DEPLOY_TOKEN:-}" ]]; then
    curl -sf -X POST "${API_BASE}/admin/release/report" \
      -H "Content-Type: application/json" \
      -H "X-Release-Token: ${RELEASE_DEPLOY_TOKEN}" \
      -d "{\"updateId\":\"${RELEASE_UPDATE_ID}\",\"phase\":\"${phase}\",\"level\":\"${level}\",\"message\":$(python3 -c "import json; print(json.dumps('${message//\'/\\\'}'))")}" \
      >/dev/null 2>&1 || true
  fi
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
  load_deploy_token
  if [[ -z "${RELEASE_DEPLOY_TOKEN:-}" ]]; then
    warn "RELEASE_DEPLOY_TOKEN не задан — manifest в Redis не обновлён (health всё равно возьмёт APP_VERSION из контейнера)"
    return 0
  fi
  if ! curl -sf -X POST "${API_BASE}/admin/release/sync" \
    -H "Content-Type: application/json" \
    -H "X-Release-Token: ${RELEASE_DEPLOY_TOKEN}" \
    -d "${manifest_json}"; then
    warn "Не удалось синхронизировать manifest в API (health использует APP_VERSION контейнера)"
  fi
}

wait_for_container_version() {
  local expected="$1"
  local i
  for i in $(seq 1 36); do
    local got
    got=$(container_app_version)
    if [[ "${got}" == "${expected}" ]]; then
      log "Контейнер APP_VERSION=${got}"
      return 0
    fi
    sleep 5
    echo -n "."
  done
  echo ""
  warn "Контейнер не подтвердил APP_VERSION=${expected} (сейчас: $(container_app_version))"
  return 1
}

main() {
  [[ "${EUID:-$(id -u)}" -eq 0 ]] || fail "Запустите от root"

  load_deploy_token

  log "Деплой версии ${VERSION} (Sprint ${SPRINT})"
  report "deploy" "info" "Старт деплоя ${VERSION} (Sprint ${SPRINT})"

  local running_version latest_line latest_version latest_sprint
  running_version=$(current_api_version)

  if read -r latest_version latest_sprint < <(read_latest_done_sprint 2>/dev/null || echo ""); then
    if [[ "$(version_gt "${latest_version}" "${VERSION}")" == "yes" && "${FORCE_DEPLOY}" != "1" ]]; then
      fail "Версия ${VERSION} устарела. На сервере ${running_version:-?}, в репозитории последний спринт ${latest_sprint} (${latest_version}). Запустите: sudo bash scripts/deploy-latest.sh"
    fi
  fi

  if [[ -n "${running_version}" && "${FORCE_DEPLOY}" != "1" ]]; then
    if [[ "$(version_gt "${running_version}" "${VERSION}")" == "yes" ]]; then
      fail "На сервере уже ${running_version}. Нельзя выкатить ${VERSION}. Используйте: sudo bash scripts/deploy-latest.sh"
    fi
  fi

  log "Pre-deploy проверка..."
  bash "${INSTALL_DIR}/scripts/verify-release.sh" pre || fail "Pre-deploy: API/DB/Redis недоступны"

  export APP_VERSION="${VERSION}"
  export SPRINT_NUMBER="${SPRINT}"
  if [[ -f "${INSTALL_DIR}/scripts/fast-update.sh" ]]; then
    report "deploy" "info" "Запуск fast-update.sh --auto"
    PARALLEL_BUILDS=1 API_USE_GHCR=1 bash "${INSTALL_DIR}/scripts/fast-update.sh" --auto
  elif [[ -f "${INSTALL_DIR}/scripts/remote-update.sh" ]]; then
    report "deploy" "info" "Запуск remote-update.sh"
    bash "${INSTALL_DIR}/scripts/remote-update.sh"
  else
    report "deploy" "info" "Запуск deploy-update.sh"
    bash "${INSTALL_DIR}/scripts/deploy-update.sh"
  fi

  wait_for_container_version "${VERSION}" || true

  PENDING_MANIFEST=$(build_manifest_json)
  log "Синхронизация manifest ${VERSION}..."
  sync_manifest_to_api "${PENDING_MANIFEST}"

  log "Post-deploy проверка..."
  if ! bash "${INSTALL_DIR}/scripts/verify-release.sh" post "${VERSION}" "${SPRINT}"; then
    report "deploy" "error" "Post-deploy проверка не прошла для ${VERSION}"
    fail "Деплой не прошёл проверку. Код мог обновиться — проверьте: curl -s ${API_BASE}/health. НЕ запускайте старые команды из админки (0.31.0/0.32.0). Используйте: sudo bash scripts/deploy-latest.sh"
  fi

  MANIFEST_JSON=$(save_manifest "${PENDING_MANIFEST}")
  log "Manifest: ${MANIFEST_JSON}"

  if [[ -n "${RELEASE_UPDATE_ID}" && -n "${RELEASE_DEPLOY_TOKEN:-}" ]]; then
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
