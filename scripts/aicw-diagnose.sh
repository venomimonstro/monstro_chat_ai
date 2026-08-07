#!/usr/bin/env bash
# AICW Deploy Diagnostic Agent — комплексная проверка сервера и сборки
# Сохраняет отчёт в /opt/monstro_chat_ai/.deploy/diagnose-report.json
# и печатает человекочитаемый summary.
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/monstro_chat_ai}"
REPORT_DIR="${INSTALL_DIR}/.deploy"
REPORT_FILE="${REPORT_DIR}/diagnose-report.json"
LOG_FILE="${REPORT_DIR}/diagnose.log"

mkdir -p "${REPORT_DIR}"
: > "${LOG_FILE}"

log() { echo -e "\033[1;32m==>\033[0m $*" | tee -a "${LOG_FILE}"; }
warn() { echo -e "\033[1;33m!!\033[0m $*" | tee -a "${LOG_FILE}"; }
fail() { echo -e "\033[1;31mERROR:\033[0m $*" | tee -a "${LOG_FILE}"; }

# JSON helpers
report_kv() { printf '%s: %s\n' "$1" "$2"; }

# State
declare -A CHECKS
ERRORS=()
WARNINGS=()

record_check() {
  local name="$1" status="$2" detail="$3"
  CHECKS["${name}"]="{\"status\":\"${status}\",\"detail\":\"${detail}\"}"
}

add_error() { ERRORS+=("$1"); }
add_warning() { WARNINGS+=("$1"); }

# 1. OS / disk
check_disk() {
  local usage
  usage="$(df -h / | awk 'NR==2 {print $5}' | tr -d '%')"
  if [[ "${usage:-100}" -lt 90 ]]; then
    record_check "disk" "ok" "usage ${usage}%"
  else
    record_check "disk" "fail" "usage ${usage}% (>=90%)"
    add_error "Disk usage ${usage}% — деплой может упасть с no space left"
  fi
}

# 2. RAM / swap
check_memory() {
  local mem_free_kb total avail swap_kb
  mem_free_kb="$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo 2>/dev/null || echo 0)"
  total="$(awk '/^MemTotal:/ {print $2}' /proc/meminfo 2>/dev/null || echo 0)"
  swap_kb="$(awk '/^SwapTotal:/ {print $2}' /proc/meminfo 2>/dev/null || echo 0)"
  if [[ "${total:-0}" -gt 0 && "${mem_free_kb:-0}" -lt 104857 && "${swap_kb:-0}" -lt 1048576 ]]; then
    record_check "memory" "warn" "RAM ${mem_free_kb}kB free, swap ${swap_kb}kB"
    add_warning "Мало RAM/swap — полный деплой может быть медленным"
  else
    record_check "memory" "ok" "RAM free ${mem_free_kb}kB, swap ${swap_kb}kB"
  fi
}

# 3. git repo state
check_git() {
  cd "${INSTALL_DIR}"
  local branch remote_url commit
  branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')"
  commit="$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
  remote_url="$(git remote get-url origin 2>/dev/null || echo 'unknown')"
  if [[ "${branch}" == "main" ]] || [[ "${branch}" == cursor/release-* ]]; then
    record_check "git_branch" "ok" "${branch}@${commit}"
  else
    record_check "git_branch" "warn" "${branch}@${commit} (not main/release)"
    add_warning "Сервер на ветке ${branch} — возможно, не та версия"
  fi
  # behind origin?
  git fetch origin 2>/dev/null || true
  local behind
  behind="$(git rev-list --count HEAD..origin/main 2>/dev/null || echo 0)"
  if [[ "${behind}" -gt 0 ]]; then
    record_check "git_behind" "fail" "${behind} commits behind origin/main"
    add_error "Сервер отстаёт от origin/main на ${behind} коммитов — нужен git pull"
  else
    record_check "git_behind" "ok" "up to date with origin/main"
  fi
}

# 4. node_modules / tsc / esbuild health
check_node_modules() {
  local tsc="${INSTALL_DIR}/node_modules/typescript/lib/tsc.js"
  local esbuild="${INSTALL_DIR}/node_modules/esbuild/bin/esbuild"
  local tsc_version esbuild_version
  tsc_version="$(node "${tsc}" --version 2>/dev/null || echo '')"
  esbuild_version="$("${esbuild}" --version 2>/dev/null || echo '')"
  if [[ -n "${tsc_version}" && -n "${esbuild_version}" ]]; then
    record_check "node_modules" "ok" "tsc ${tsc_version}, esbuild ${esbuild_version}"
  else
    record_check "node_modules" "fail" "tsc/esbuild missing or broken"
    add_error "node_modules повреждён — запустите scripts/fix-npm-install.sh"
  fi
}

# 5. systemd units
check_units() {
  local unit status
  local -A units=(
    [monstro-api]="API"
    [monstro-web-client]="ЛК"
    [monstro-web-admin]="Админка"
    [monstro-public-site]="Сайт"
    [monstro-widget]="Виджет"
    [nginx]="Nginx"
  )
  for unit in "${!units[@]}"; do
    if systemctl list-unit-files "${unit}.service" >/dev/null 2>&1; then
      if systemctl is-active --quiet "${unit}" 2>/dev/null; then
        record_check "unit_${unit}" "ok" "active"
      else
        record_check "unit_${unit}" "fail" "inactive"
        add_error "Сервис ${units[$unit]} (${unit}) не запущен — systemctl start ${unit}"
      fi
    else
      record_check "unit_${unit}" "warn" "unit not found"
      add_warning "Unit ${unit} не найден — возможно, сервис не создавался"
    fi
  done
}

# 6. HTTP smoke tests
check_http() {
  local code body
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:3000/api/health 2>/dev/null || echo 000)"
  if [[ "${code}" == "200" ]]; then
    record_check "api_health" "ok" "HTTP ${code}"
  else
    record_check "api_health" "fail" "HTTP ${code}"
    add_error "API health не отвечает (HTTP ${code})"
  fi

  for port in 5173 5174 4321 5175; do
    local label unit
    case "${port}" in
      5173) label="ЛК"; unit="monstro-web-client" ;;
      5174) label="Админка"; unit="monstro-web-admin" ;;
      4321) label="Сайт"; unit="monstro-public-site" ;;
      5175) label="Виджет"; unit="monstro-widget" ;;
    esac
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:${port}/" 2>/dev/null || echo 000)"
    if [[ "${code}" == "200" || "${code}" == "302" || "${code}" == "404" ]]; then
      record_check "port_${port}" "ok" "HTTP ${code} (${label})"
    else
      record_check "port_${port}" "fail" "HTTP ${code} (${label})"
      add_error "${label} (${unit}) на :${port} недоступен (HTTP ${code})"
    fi
  done
}

# 7. Auth route correctness (critical: GET /api/auth/me must exist)
check_auth_routes() {
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:3000/api/auth/me 2>/dev/null || echo 000)"
  if [[ "${code}" == "401" || "${code}" == "403" || "${code}" == "200" ]]; then
    record_check "route_auth_me" "ok" "GET /api/auth/me HTTP ${code}"
  else
    record_check "route_auth_me" "fail" "GET /api/auth/me HTTP ${code} (expected 401/403/200)"
    add_error "GET /api/auth/me неправильно отвечает (${code}) — админка/ЛК зависнут на Загрузка..."
  fi
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:3000/api/auth/csrf 2>/dev/null || echo 000)"
  if [[ "${code}" == "200" ]]; then
    record_check "route_auth_csrf" "ok" "HTTP ${code}"
  else
    record_check "route_auth_csrf" "fail" "HTTP ${code}"
    add_error "CSRF endpoint не отвечает"
  fi
}

# 8. Build check (shared-types first, then api lint)
check_build() {
  cd "${INSTALL_DIR}"
  if npm run build -w @ai-consultant/shared-types >/dev/null 2>&1; then
    record_check "build_shared_types" "ok" "compiled"
  else
    record_check "build_shared_types" "fail" "compile error"
    add_error "shared-types не собирается — проверьте tsc"
  fi
  cd "${INSTALL_DIR}/apps/api"
  if node ../../node_modules/typescript/lib/tsc.js --noEmit >/dev/null 2>&1; then
    record_check "build_api" "ok" "tsc noEmit ok"
  else
    record_check "build_api" "fail" "tsc errors"
    add_error "API TypeScript не компилируется"
  fi
}

# 9. Nginx / domain
check_nginx() {
  local code
  if command -v nginx >/dev/null 2>&1 && systemctl is-active --quiet nginx 2>/dev/null; then
    record_check "nginx" "ok" "active"
  else
    record_check "nginx" "warn" "nginx not active/missing"
  fi
}

# Build JSON report
build_report() {
  local json="{"
  json+="\"timestamp\":\"$(date -Iseconds)\","
  json+="\"installDir\":\"${INSTALL_DIR}\","
  json+="\"summary\":{\"errors\":${#ERRORS[@]},\"warnings\":${#WARNINGS[@]}},"
  json+="\"checks\":{"
  local first=1
  for key in "${!CHECKS[@]}"; do
    [[ "${first}" -eq 1 ]] || json+=","
    first=0
    json+="\"${key}\":${CHECKS[$key]}"
  done
  json+="},"
  json+="\"errors\":["
  first=1
  for e in "${ERRORS[@]}"; do
    [[ "${first}" -eq 1 ]] || json+=","
    first=0
    json+="\"${e}\""
  done
  json+="],"
  json+="\"warnings\":["
  first=1
  for w in "${WARNINGS[@]}"; do
    [[ "${first}" -eq 1 ]] || json+=","
    first=0
    json+="\"${w}\""
  done
  json+="]}"
  echo "${json}" > "${REPORT_FILE}"
}

print_summary() {
  echo ""
  echo "=============================================="
  echo "  AICW DIAGNOSTIC REPORT"
  echo "=============================================="
  echo "  Файл: ${REPORT_FILE}"
  echo "  Лог:  ${LOG_FILE}"
  echo "  Ошибок:  ${#ERRORS[@]}"
  echo "  Предупреждений: ${#WARNINGS[@]}"
  echo ""
  if [[ ${#ERRORS[@]} -gt 0 ]]; then
    echo "  Ошибки:"
    for e in "${ERRORS[@]}"; do echo "    - ${e}"; done
  fi
  if [[ ${#WARNINGS[@]} -gt 0 ]]; then
    echo "  Предупреждения:"
    for w in "${WARNINGS[@]}"; do echo "    - ${w}"; done
  fi
  echo ""
  echo "  Быстрые команды:"
  echo "    sudo bash scripts/fast-update.sh --full --no-pull"
  echo "    sudo bash scripts/recover-frontends.sh"
  echo "    sudo bash scripts/fix-npm-install.sh"
  echo "=============================================="
}

FULL_MODE=0

usage() {
  echo "Usage: $0 [--quick|--full|-h]"
  echo "  --quick  only runtime checks (fast, default for timer)"
  echo "  --full   include npm/build checks (run after deploy)"
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --full) FULL_MODE=1 ;;
    --quick) FULL_MODE=0 ;;
    -h|--help) usage ;;
    *) warn "Неизвестный аргумент: $1 (используйте --quick или --full)" ;;
  esac
  shift
done

main() {
  log "AICW Diagnostic Agent v1 — режим: $([[ "${FULL_MODE}" -eq 1 ]] && echo full || echo quick)"
  check_disk
  check_memory
  check_git
  check_node_modules
  check_units
  check_http
  check_auth_routes
  if [[ "${FULL_MODE}" -eq 1 ]]; then
    check_build
  else
    record_check "build" "ok" "skipped in quick mode (run --full after deploy)"
  fi
  check_nginx
  build_report
  print_summary
  if [[ ${#ERRORS[@]} -gt 0 ]]; then
    exit 1
  fi
}

main "$@"
