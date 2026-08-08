#!/usr/bin/env bash
# Автоматически прописывает production URL для redflow.ru в .env
# Usage: sudo bash scripts/apply-redflow-env.sh
set -euo pipefail

DOMAIN="${DOMAIN:-redflow.ru}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/resolve-install-dir.sh
source "${SCRIPT_DIR}/lib/resolve-install-dir.sh"
# shellcheck source=lib/env-set.sh
source "${SCRIPT_DIR}/lib/env-set.sh"

ENV_FILE="${INSTALL_DIR}/.env"
cd "${INSTALL_DIR}"

log()  { echo -e "\n\033[1;32m==>\033[0m $*"; }
warn() { echo -e "\033[1;33m!!\033[0m $*"; }

[[ "${EUID:-$(id -u)}" -eq 0 ]] || {
  echo "Запустите от root: sudo bash scripts/apply-redflow-env.sh" >&2
  exit 1
}

if [[ ! -f "${ENV_FILE}" ]]; then
  warn ".env не найден — создаю из .env.example"
  if [[ -f "${INSTALL_DIR}/.env.example" ]]; then
    cp "${INSTALL_DIR}/.env.example" "${ENV_FILE}"
  else
    touch "${ENV_FILE}"
  fi
fi

BASE="https://${DOMAIN}"

log "RedFlow — обновление ${ENV_FILE}"

env_set COOKIE_SECURE true
env_set APP_NAME RedFlow
env_set HOST_INSTALL_DIR "${INSTALL_DIR}"
env_set DEPLOY_HEALTH_URL "http://127.0.0.1:3000/api/health"

env_set PUBLIC_SITE_URL "${BASE}"
env_set WEB_CLIENT_URL "${BASE}/app"
env_set WEB_ADMIN_URL "${BASE}/admin"
env_set WIDGET_URL "${BASE}"
env_set API_PUBLIC_URL "${BASE}/api"

env_set NEXT_PUBLIC_SITE_URL "${BASE}"
env_set NEXT_PUBLIC_CLIENT_URL "${BASE}/app"
env_set NEXT_PUBLIC_WIDGET_URL "${BASE}"
env_set NEXT_PUBLIC_API_URL "${BASE}/api"

env_set VITE_WIDGET_SCRIPT_URL "${BASE}/embed.js"
env_set VITE_API_URL "${BASE}/api"
env_set VITE_WIDGET_URL "${BASE}"
env_set VITE_CLIENT_BASE_PATH "/app/"
env_set VITE_ADMIN_BASE_PATH "/admin/"

env_set STABILITY_CLIENT_URL "http://host.docker.internal:5173"
env_set STABILITY_ADMIN_URL "http://host.docker.internal:5174"
env_set STABILITY_WIDGET_URL "http://host.docker.internal:5175"

env_set API_INTERNAL_URL "http://127.0.0.1:3000"
env_set CRAWL_INTERNAL_ORIGIN "http://127.0.0.1:4321"
env_set WIDGET_CORS_ORIGINS "${BASE},${BASE}/app,${BASE}/admin,http://127.0.0.1:4321"

# NODE_ENV=production требует все YooKassa-секреты — не переключаем автоматически
env_set_if_missing NODE_ENV development
env_set_if_missing SKIP_2FA_ENFORCEMENT true

existing_token="$(env_get RELEASE_DEPLOY_TOKEN || true)"
if [[ -z "${existing_token}" || "${existing_token}" == *change_me* ]]; then
  new_token="$(openssl rand -hex 24 2>/dev/null || head -c 48 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 48)"
  env_set RELEASE_DEPLOY_TOKEN "${new_token}"
  log "RELEASE_DEPLOY_TOKEN сгенерирован автоматически"
else
  log "RELEASE_DEPLOY_TOKEN сохранён (не менялся)"
fi

log "Готово. Ключевые переменные:"
grep -E '^(COOKIE_SECURE|APP_NAME|HOST_INSTALL_DIR|PUBLIC_SITE_URL|WEB_CLIENT_URL|WEB_ADMIN_URL|WIDGET_URL|API_PUBLIC_URL|RELEASE_DEPLOY_TOKEN)=' "${ENV_FILE}" \
  | sed 's/RELEASE_DEPLOY_TOKEN=.*/RELEASE_DEPLOY_TOKEN=***/'

echo ""
echo "Перезапуск сервисов: sudo bash scripts/fast-update.sh --full --no-pull"
