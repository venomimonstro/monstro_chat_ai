#!/usr/bin/env bash
# Host deploy agent: забирает задачи из админки и выполняет release-deploy/rollback
# Usage: sudo bash scripts/host-deploy-agent.sh
# Cron: * * * * * root /opt/monstro_chat_ai/scripts/host-deploy-agent.sh >> /var/log/aicw-deploy-agent.log 2>&1
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/monstro_chat_ai}"
API_BASE="${API_BASE:-http://127.0.0.1:3000/api}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=lib/release-version.sh
source "${SCRIPT_DIR}/lib/release-version.sh"

log() { echo "[$(date -Iseconds)] $*"; }

load_deploy_token

if [[ -z "${RELEASE_DEPLOY_TOKEN:-}" ]]; then
  log "RELEASE_DEPLOY_TOKEN не задан — agent пропущен"
  exit 0
fi

claim_job() {
  curl -sf -H "X-Release-Token: ${RELEASE_DEPLOY_TOKEN}" \
    "${API_BASE}/admin/release/host-job/next"
}

finish_job() {
  curl -sf -X POST "${API_BASE}/admin/release/host-job/finished" \
    -H "Content-Type: application/json" \
    -H "X-Release-Token: ${RELEASE_DEPLOY_TOKEN}" \
    -d "$1" >/dev/null 2>&1 || true
}

parse_job_field() {
  local json="$1"
  local field="$2"
  echo "${json}" | python3 -c "import sys,json; d=json.load(sys.stdin); v=d.get('${field}'); print('' if v is None else v)"
}

run_deploy() {
  local update_id="$1"
  local version="$2"
  local sprint="$3"
  log "Deploy ${version} (sprint ${sprint}), updateId=${update_id}"
  export RELEASE_UPDATE_ID="${update_id}"
  if bash "${INSTALL_DIR}/scripts/release-deploy.sh" "${version}" "${sprint}"; then
    finish_job "{\"type\":\"deploy\",\"success\":true,\"updateId\":\"${update_id}\",\"version\":\"${version}\",\"sprint\":${sprint}}"
    log "Deploy ${version} OK"
  else
    finish_job "{\"type\":\"deploy\",\"success\":false,\"updateId\":\"${update_id}\",\"version\":\"${version}\",\"sprint\":${sprint}}"
    log "Deploy ${version} FAILED"
    return 1
  fi
}

run_rollback() {
  local update_id="$1"
  local target="$2"
  local version="$3"
  local sprint="$4"
  log "Rollback to ${target:-previous}"
  local ok=0
  if [[ -n "${target}" ]]; then
    bash "${INSTALL_DIR}/scripts/release-rollback.sh" "${target}" && ok=1
  else
    bash "${INSTALL_DIR}/scripts/release-rollback.sh" && ok=1
  fi
  if [[ "${ok}" -eq 1 ]]; then
    local payload="{\"type\":\"rollback\",\"success\":true,\"version\":\"${version}\",\"sprint\":${sprint}"
    [[ -n "${update_id}" ]] && payload="${payload},\"updateId\":\"${update_id}\""
    [[ -n "${target}" ]] && payload="${payload},\"rollbackTarget\":\"${target}\""
    payload="${payload}}"
    finish_job "${payload}"
    log "Rollback OK"
  else
    finish_job "{\"type\":\"rollback\",\"success\":false,\"version\":\"${version}\",\"sprint\":${sprint}}"
    log "Rollback FAILED"
    return 1
  fi
}

main() {
  local raw job
  raw=$(claim_job) || { log "API недоступен"; exit 0; }
  job=$(echo "${raw}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d.get('job')))" 2>/dev/null || echo "null")
  if [[ "${job}" == "null" ]]; then
    exit 0
  fi

  local type update_id version sprint rollback_target
  type=$(parse_job_field "${job}" "type")
  update_id=$(parse_job_field "${job}" "updateId")
  version=$(parse_job_field "${job}" "version")
  sprint=$(parse_job_field "${job}" "sprint")
  rollback_target=$(parse_job_field "${job}" "rollbackTarget")

  if [[ "${type}" == "deploy" ]]; then
    run_deploy "${update_id}" "${version}" "${sprint}"
  elif [[ "${type}" == "rollback" ]]; then
    run_rollback "${update_id}" "${rollback_target}" "${version}" "${sprint}"
  else
    log "Unknown job type: ${type}"
  fi
}

main "$@"
