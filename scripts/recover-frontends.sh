#!/usr/bin/env bash
# Срочное восстановление при nginx 502 (фронт-сервисы down после npm/деплоя)
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/monstro_chat_ai}"
cd "${INSTALL_DIR}"

# shellcheck source=lib/deploy-common.sh
source "${INSTALL_DIR}/scripts/lib/deploy-common.sh"

[[ "${EUID:-$(id -u)}" -eq 0 ]] || deploy_fail "Запустите от root: sudo bash scripts/recover-frontends.sh"

deploy_log "Recover frontends — подъём сервисов после 502"

for unit in monstro-web-client monstro-web-admin monstro-public-site monstro-widget; do
  if deploy_unit_exists "${unit}"; then
    deploy_ensure_service "${unit}" || deploy_warn "Не удалось start ${unit}"
  else
    deploy_warn "Unit ${unit} не найден"
  fi
done

# Если unit'ов нет — создаём без полной пересборки (если dist уже есть)
if ! deploy_unit_exists monstro-web-admin || ! deploy_unit_exists monstro-web-client; then
  if [[ -d apps/web-admin/dist && -d apps/web-client/dist ]]; then
    SKIP_FRONTEND_BUILD=1 bash "${INSTALL_DIR}/scripts/start-frontend.sh"
  else
    deploy_warn "Нет dist у ЛК/админки — нужен: sudo bash scripts/fast-update.sh --frontends --no-pull"
  fi
fi

if ! deploy_unit_exists monstro-public-site; then
  if [[ -d apps/public-site/.next || -d apps/public-site/dist ]]; then
    SKIP_SITE_BUILD=1 bash "${INSTALL_DIR}/scripts/start-public-site.sh"
  else
    deploy_warn "Нет сборки сайта — нужен: sudo bash scripts/fast-update.sh --site --no-pull"
  fi
fi

sleep 2
deploy_verify_frontends || deploy_warn "Часть сервисов ещё не отвечает — смотрите journalctl"

echo ""
echo "Проверка:"
echo "  curl -s -o /dev/null -w '%{http_code}\\n' http://127.0.0.1:5174/"
echo "  curl -s -o /dev/null -w '%{http_code}\\n' http://127.0.0.1:4321/"
echo "  systemctl status monstro-web-admin monstro-public-site --no-pager"
