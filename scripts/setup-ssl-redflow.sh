#!/usr/bin/env bash
# SSL + nginx для redflow.ru на Beget VPS
# Usage: sudo bash scripts/setup-ssl-redflow.sh
set -euo pipefail

DOMAIN="${DOMAIN:-redflow.ru}"
WWW="${WWW_DOMAIN:-www.redflow.ru}"
SERVER_IP="${SERVER_IP:-31.128.42.106}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/resolve-install-dir.sh
source "${SCRIPT_DIR}/lib/resolve-install-dir.sh"
# shellcheck source=lib/nginx-redflow.sh
source "${SCRIPT_DIR}/lib/nginx-redflow.sh"
# shellcheck source=lib/open-firewall.sh
source "${SCRIPT_DIR}/lib/open-firewall.sh"
# shellcheck source=lib/ensure-api.sh
source "${SCRIPT_DIR}/lib/ensure-api.sh"
# shellcheck source=lib/certbot-webroot.sh
source "${SCRIPT_DIR}/lib/certbot-webroot.sh"

log()  { echo -e "\n\033[1;32m==>\033[0m $*"; }
warn() { echo -e "\033[1;33m!!\033[0m $*"; }
fail() { echo -e "\033[1;31mERROR:\033[0m $*" >&2; exit 1; }

[[ "${EUID:-$(id -u)}" -eq 0 ]] || fail "Запустите от root"

log "RedFlow — nginx + SSL для ${DOMAIN}"

apt-get update -qq
apt-get install -y -qq nginx certbot python3-certbot-nginx curl dnsutils

log "1. Firewall (порты 80/443)"
open_redflow_firewall

log "2. DNS"
APEX_IP="$(dig +short "${DOMAIN}" @8.8.8.8 | tail -1)"
WWW_IP="$(dig +short "${WWW}" @8.8.8.8 | tail -1)"
log "${DOMAIN} → ${APEX_IP:-?}"
log "${WWW} → ${WWW_IP:-?}"
if [[ "${APEX_IP}" != "${SERVER_IP}" ]]; then
  warn "${DOMAIN} не указывает на ${SERVER_IP}"
fi
if [[ -n "${WWW_IP}" && "${WWW_IP}" != "${SERVER_IP}" ]]; then
  warn "${WWW} → ${WWW_IP} (нужен ${SERVER_IP}). Certbot только для ${DOMAIN}"
  WWW=""
fi

log "3. API (Docker)"
ensure_api_stack "${INSTALL_DIR}"

log "4. Публичный сайт :4321"
if ! curl -sf --max-time 5 -o /dev/null "http://127.0.0.1:4321/"; then
  warn "Сайт не отвечает — пересборка..."
  bash "${INSTALL_DIR}/scripts/apply-redflow-env.sh" 2>/dev/null || true
  bash "${INSTALL_DIR}/scripts/lib/build-site.sh" 2>/dev/null \
    || bash "${INSTALL_DIR}/scripts/start-public-site.sh" || true
  sleep 5
fi

log "5. Nginx (HTTP, webroot для certbot)"
redflow_nginx_apply "${DOMAIN}" "${WWW:-www.${DOMAIN}}"

log "6. Проверка webroot локально"
mkdir -p /var/www/html/.well-known/acme-challenge
echo ok > /var/www/html/.well-known/acme-challenge/ping
if curl -sf --max-time 5 -H "Host: ${DOMAIN}" \
  "http://127.0.0.1/.well-known/acme-challenge/ping" | grep -q ok; then
  log "webroot OK"
else
  warn "webroot не отдаётся nginx — certbot может не сработать"
fi

if [[ ! -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]]; then
  log "7. SSL (certbot webroot)"
  if redflow_certbot_webroot "${DOMAIN}" "${WWW:-www.${DOMAIN}}"; then
    log "Сертификат получен"
  else
    warn "Certbot не смог выпустить сертификат"
    warn "Причина часто — firewall Beget: панель → VPS → открыть TCP 80 и 443"
    warn "Сайт временно доступен: http://${DOMAIN}/"
  fi
  redflow_nginx_apply "${DOMAIN}" "${WWW:-www.${DOMAIN}}"
else
  log "7. SSL уже установлен"
fi

log "8. .env + пересборка"
bash "${INSTALL_DIR}/scripts/apply-redflow-env.sh"
bash "${INSTALL_DIR}/scripts/lib/sync-systemd-units.sh" "${INSTALL_DIR}"
ensure_api_stack "${INSTALL_DIR}"
bash "${INSTALL_DIR}/scripts/fast-update.sh" --full --no-pull

log "9. Проверка"
bash "${INSTALL_DIR}/scripts/verify-redflow.sh" || warn "Есть предупреждения"

log "Готово: https://${DOMAIN}/ (или http:// если SSL не выпустился)"
