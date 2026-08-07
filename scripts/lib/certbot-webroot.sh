#!/usr/bin/env bash
# SSL через webroot (надёжнее certbot --nginx при кастомном конфиге)
set -euo pipefail

redflow_certbot_webroot() {
  local domain="${1:-redflow.ru}"
  local www="${2:-www.${domain}}"
  local email="${3:-admin@${domain}}"

  mkdir -p /var/www/html/.well-known/acme-challenge
  chown -R www-data:www-data /var/www/html 2>/dev/null || true
  chmod -R u+rwX /var/www/html 2>/dev/null || true

  if [[ -f "/etc/letsencrypt/live/${domain}/fullchain.pem" ]]; then
    echo "Сертификат уже есть: /etc/letsencrypt/live/${domain}/"
    return 0
  fi

  local domains=(-d "${domain}")
  local www_ip apex_ip
  apex_ip="$(dig +short "${domain}" @8.8.8.8 | tail -1)"
  www_ip="$(dig +short "${www}" @8.8.8.8 | tail -1)"
  if [[ -n "${www_ip}" && "${www_ip}" == "${apex_ip}" ]]; then
    domains+=(-d "${www}")
  fi

  echo "Запрос сертификата Let's Encrypt (webroot) для ${domain}..."
  certbot certonly --webroot \
    -w /var/www/html \
    "${domains[@]}" \
    --non-interactive --agree-tos \
    -m "${email}" \
    --preferred-challenges http
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  redflow_certbot_webroot "${1:-redflow.ru}" "${2:-www.redflow.ru}"
fi
