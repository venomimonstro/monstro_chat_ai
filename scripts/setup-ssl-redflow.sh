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

log()  { echo -e "\n\033[1;32m==>\033[0m $*"; }
warn() { echo -e "\033[1;33m!!\033[0m $*"; }
fail() { echo -e "\033[1;31mERROR:\033[0m $*" >&2; exit 1; }

[[ "${EUID:-$(id -u)}" -eq 0 ]] || fail "Запустите от root"

log "RedFlow — nginx + SSL для ${DOMAIN}"

apt-get update -qq
apt-get install -y -qq nginx certbot python3-certbot-nginx curl dnsutils

log "Проверка DNS..."
APEX_IP="$(dig +short "${DOMAIN}" @8.8.8.8 | tail -1)"
WWW_IP="$(dig +short "${WWW}" @8.8.8.8 | tail -1)"
log "${DOMAIN} → ${APEX_IP:-?}"
log "${WWW} → ${WWW_IP:-?}"

if [[ "${APEX_IP}" != "${SERVER_IP}" ]]; then
  warn "${DOMAIN} не указывает на ${SERVER_IP} — certbot может не сработать"
fi
if [[ -n "${WWW_IP}" && "${WWW_IP}" != "${SERVER_IP}" ]]; then
  warn "${WWW} → ${WWW_IP}, а нужен ${SERVER_IP}. Исправьте A-запись www в Beget!"
  warn "Пока www неверный — certbot только для ${DOMAIN}"
  WWW=""
fi

log "Проверка backend :4321 (публичный сайт)..."
if ! curl -sf --max-time 5 -o /dev/null "http://127.0.0.1:4321/"; then
  warn "Сайт на :4321 не отвечает — пересборка..."
  bash "${INSTALL_DIR}/scripts/apply-redflow-env.sh"
  bash "${INSTALL_DIR}/scripts/lib/build-site.sh" || bash "${INSTALL_DIR}/scripts/start-public-site.sh"
  sleep 5
  curl -sf --max-time 10 -o /dev/null "http://127.0.0.1:4321/" \
    || fail "Публичный сайт не запустился. Логи: journalctl -u monstro-public-site -n 40"
fi

log "Nginx конфиг..."
redflow_nginx_apply "${DOMAIN}" "${WWW:-www.${DOMAIN}}"

if [[ ! -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]]; then
  log "Получение SSL Let's Encrypt..."
  cert_args=(-d "${DOMAIN}")
  [[ -n "${WWW}" ]] && cert_args+=(-d "${WWW}")
  certbot --nginx "${cert_args[@]}" --non-interactive --agree-tos \
    -m "admin@${DOMAIN}" --redirect || {
    warn "Certbot не выпустил сертификат — сайт доступен по http://${DOMAIN}"
    warn "Повторите: certbot --nginx -d ${DOMAIN}"
  }
  # Перезаписываем конфиг с SSL-блоком (certbot мог изменить файл)
  redflow_nginx_apply "${DOMAIN}" "${WWW:-www.${DOMAIN}}"
fi

log "Автонастройка .env..."
bash "${INSTALL_DIR}/scripts/apply-redflow-env.sh"

log "Синхронизация systemd + пересборка..."
bash "${INSTALL_DIR}/scripts/lib/sync-systemd-units.sh" "${INSTALL_DIR}"
bash "${INSTALL_DIR}/scripts/fast-update.sh" --full --no-pull

log "Проверка..."
bash "${INSTALL_DIR}/scripts/verify-redflow.sh" || warn "Есть предупреждения"

log "Готово: https://${DOMAIN}/"
