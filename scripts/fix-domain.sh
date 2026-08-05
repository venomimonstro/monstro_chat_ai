#!/usr/bin/env bash
# Починка домена redflow.ru: .env, systemd, nginx, пересборка, проверка
# Usage: sudo bash scripts/fix-domain.sh
set -euo pipefail

DOMAIN="${DOMAIN:-redflow.ru}"
WWW="${WWW_DOMAIN:-www.redflow.ru}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/resolve-install-dir.sh
source "${SCRIPT_DIR}/lib/resolve-install-dir.sh"
# shellcheck source=lib/nginx-redflow.sh
source "${SCRIPT_DIR}/lib/nginx-redflow.sh"

[[ "${EUID:-$(id -u)}" -eq 0 ]] || {
  echo "Запустите от root: sudo bash scripts/fix-domain.sh" >&2
  exit 1
}

echo "==> 1. .env"
bash "${INSTALL_DIR}/scripts/apply-redflow-env.sh"

echo "==> 2. npm"
bash "${INSTALL_DIR}/scripts/fix-npm-install.sh"

echo "==> 3. Сборка + systemd"
bash "${INSTALL_DIR}/scripts/lib/sync-systemd-units.sh" "${INSTALL_DIR}"
bash "${INSTALL_DIR}/scripts/fast-update.sh" --full --no-pull

echo "==> 4. nginx"
redflow_nginx_apply "${DOMAIN}" "${WWW}"

if [[ ! -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]]; then
  echo "==> 5. SSL certbot"
  certbot --nginx -d "${DOMAIN}" -d "${WWW}" --non-interactive --agree-tos \
    -m "admin@${DOMAIN}" --redirect 2>/dev/null || \
    certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos \
    -m "admin@${DOMAIN}" --redirect || true
  redflow_nginx_apply "${DOMAIN}" "${WWW}"
fi

echo "==> 6. Проверка"
bash "${INSTALL_DIR}/scripts/verify-redflow.sh"
