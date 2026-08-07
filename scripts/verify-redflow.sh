#!/usr/bin/env bash
# Проверка RedFlow после деплоя (шаг 6 — автоматически)
# Usage: sudo bash scripts/verify-redflow.sh
set -euo pipefail

DOMAIN="${DOMAIN:-redflow.ru}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/resolve-install-dir.sh
source "${SCRIPT_DIR}/lib/resolve-install-dir.sh"

log()   { echo -e "\033[1;32m[ok]\033[0m $*"; }
warn()  { echo -e "\033[1;33m[warn]\033[0m $*"; }
fail()  { echo -e "\033[1;31m[fail]\033[0m $*" >&2; ERR=1; }
info()  { echo -e "\033[0;36m[check]\033[0m $*"; }

ERR=0
BASE="https://${DOMAIN}"
SERVER_IP="${SERVER_IP:-31.128.42.106}"

info "DNS ${DOMAIN}"
APEX_IP="$(dig +short "${DOMAIN}" @8.8.8.8 | tail -1)"
if [[ "${APEX_IP}" == "${SERVER_IP}" ]]; then
  log "${DOMAIN} → ${APEX_IP}"
else
  fail "${DOMAIN} → ${APEX_IP:-?} (ожидался ${SERVER_IP})"
fi

info "DNS www.${DOMAIN}"
WWW_IP="$(dig +short "www.${DOMAIN}" @8.8.8.8 | tail -1)"
if [[ -z "${WWW_IP}" ]]; then
  warn "www.${DOMAIN} — нет A-записи"
elif [[ "${WWW_IP}" == "${SERVER_IP}" ]]; then
  log "www.${DOMAIN} → ${WWW_IP}"
else
  fail "www.${DOMAIN} → ${WWW_IP} (ожидался ${SERVER_IP}) — исправьте DNS в Beget!"
fi

info "Внешний доступ :80 (Let's Encrypt)"
if timeout 8 bash -c "echo > /dev/tcp/${SERVER_IP}/80" 2>/dev/null; then
  log "TCP ${SERVER_IP}:80 открыт локально"
else
  warn "TCP :80 не отвечает — проверьте ufw и firewall Beget"
fi
if curl -sf --max-time 8 -o /dev/null -H "Host: ${DOMAIN}" "http://127.0.0.1/"; then
  log "nginx проксирует сайт (localhost:80)"
else
  fail "nginx не отдаёт сайт на :80 — запустите: sudo bash scripts/setup-ssl-redflow.sh"
fi

info "Docker API"
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^aicw-api$'; then
  log "контейнер aicw-api запущен"
else
  fail "контейнер aicw-api не запущен — sudo bash scripts/lib/ensure-api.sh"
fi

info "API health (localhost)"
if body="$(curl -sf --max-time 10 "http://127.0.0.1:3000/api/health" 2>/dev/null)"; then
  log "API: ${body}"
else
  fail "API health недоступен на :3000"
fi

info "API health/db"
curl -sf --max-time 10 "http://127.0.0.1:3000/api/health/db" | grep -q connected \
  && log "PostgreSQL подключена" \
  || fail "База данных недоступна"

info "API health/redis"
curl -sf --max-time 10 "http://127.0.0.1:3000/api/health/redis" | grep -q connected \
  && log "Redis подключён" \
  || fail "Redis недоступен"

info "Локальные сервисы"
while read -r label port path; do
  if curl -sf --max-time 8 -o /dev/null "http://127.0.0.1:${port}${path}"; then
    log "${label} :${port}${path}"
  else
    fail "${label} не отвечает на :${port}${path} — journalctl -u monstro-*"
  fi
done <<EOF
Админка 5174 /admin/
ЛК 5173 /app/
Виджет 5175 /health.txt
Сайт 4321 /
EOF

info "HTTPS ${DOMAIN}"
if code="$(curl -sf --max-time 15 -o /dev/null -w '%{http_code}' "${BASE}/" 2>/dev/null)"; then
  [[ "${code}" =~ ^(200|301|302|304)$ ]] && log "Сайт ${BASE}/ → HTTP ${code}" \
    || fail "Сайт ${BASE}/ → HTTP ${code}"
else
  warn "HTTPS ${BASE}/ недоступен (DNS/SSL/nginx?) — локальные сервисы могут работать"
fi

info "HTTPS API ${BASE}/api/health"
if curl -sf --max-time 15 "${BASE}/api/health" >/dev/null 2>&1; then
  log "API через nginx: ${BASE}/api/health"
else
  warn "API через домен недоступен — проверьте nginx и certbot"
fi

info "HTTPS админка ${BASE}/admin/"
if curl -sf --max-time 15 -o /dev/null "${BASE}/admin/"; then
  log "Админка: ${BASE}/admin/"
else
  warn "Админка через домен недоступна"
fi

info "Release manifest"
if curl -sf --max-time 10 "http://127.0.0.1:3000/api/public/release" >/dev/null 2>&1; then
  log "public/release OK"
else
  warn "public/release недоступен"
fi

echo ""
echo "=============================================="
if [[ "${ERR}" -eq 0 ]]; then
  echo "  RedFlow — проверка пройдена"
else
  echo "  RedFlow — есть проблемы (см. выше)"
fi
echo "=============================================="
echo "  Сайт:    ${BASE}"
echo "  ЛК:      ${BASE}/app"
echo "  Админка: ${BASE}/admin"
echo "  API:     ${BASE}/api/health"
echo "  Спринты: ${BASE}/admin/sprints"
echo "=============================================="

exit "${ERR}"
