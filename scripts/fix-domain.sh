#!/usr/bin/env bash
# Починка домена redflow.ru: firewall, API, .env, nginx, SSL, verify
# Usage: sudo bash scripts/fix-domain.sh
set -euo pipefail

DOMAIN="${DOMAIN:-redflow.ru}"
WWW="${WWW_DOMAIN:-www.redflow.ru}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/resolve-install-dir.sh
source "${SCRIPT_DIR}/lib/resolve-install-dir.sh"
# shellcheck source=lib/open-firewall.sh
source "${SCRIPT_DIR}/lib/open-firewall.sh"
# shellcheck source=lib/ensure-api.sh
source "${SCRIPT_DIR}/lib/ensure-api.sh"

[[ "${EUID:-$(id -u)}" -eq 0 ]] || {
  echo "Запустите от root: sudo bash scripts/fix-domain.sh" >&2
  exit 1
}

echo "==> 0. Firewall 80/443"
open_redflow_firewall

echo "==> 1. .env"
bash "${INSTALL_DIR}/scripts/apply-redflow-env.sh"

echo "==> 2. npm"
bash "${INSTALL_DIR}/scripts/fix-npm-install.sh"

echo "==> 3. API (Docker)"
ensure_api_stack "${INSTALL_DIR}"

echo "==> 4. Сборка + systemd"
bash "${INSTALL_DIR}/scripts/lib/sync-systemd-units.sh" "${INSTALL_DIR}"
bash "${INSTALL_DIR}/scripts/fast-update.sh" --full --no-pull

echo "==> 5. nginx + SSL"
DOMAIN="${DOMAIN}" WWW_DOMAIN="${WWW}" bash "${INSTALL_DIR}/scripts/setup-ssl-redflow.sh"

echo ""
echo "Если SSL снова не выпустился — в панели Beget откройте входящие TCP 80 и 443."
