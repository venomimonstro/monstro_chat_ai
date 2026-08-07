#!/usr/bin/env bash
# ЭКСТРЕННОЕ восстановление при nginx 502 (сайт/админка/ЛК недоступны)
# Usage: sudo bash scripts/emergency-recover-502.sh
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/monstro_chat_ai}"
cd "${INSTALL_DIR}"

# shellcheck source=lib/deploy-common.sh
source "${INSTALL_DIR}/scripts/lib/deploy-common.sh"

[[ "${EUID:-$(id -u)}" -eq 0 ]] || deploy_fail "Запустите от root: sudo bash scripts/emergency-recover-502.sh"

deploy_log "=== ЭКСТРЕННОЕ ВОССТАНОВЛЕНИЕ 502 ==="

# 1. API (Docker)
deploy_log "Поднимаю API (Docker)..."
if [[ -f docker-compose.yml ]]; then
  docker compose up -d postgres redis minio 2>/dev/null || true
  sleep 3
  docker compose up -d --force-recreate api 2>/dev/null || docker compose up -d api 2>/dev/null || true
  for i in $(seq 1 24); do
    if curl -sf --max-time 3 http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
      deploy_log "API OK"
      break
    fi
    sleep 3
  done
else
  deploy_warn "docker-compose.yml не найден"
fi

# 2. Правильные systemd unit'ы (node vite/next напрямую, без .bin symlink)
deploy_log "Синхронизация systemd unit'ов..."
bash "${INSTALL_DIR}/scripts/lib/npm-fix-bins.sh" "${INSTALL_DIR}"
bash "${INSTALL_DIR}/scripts/lib/sync-systemd-units.sh" "${INSTALL_DIR}"

# 3. Проверка артефактов сборки
need_rebuild=0
[[ ! -d apps/web-admin/dist ]] && need_rebuild=1 && deploy_warn "Нет apps/web-admin/dist"
[[ ! -d apps/web-client/dist ]] && need_rebuild=1 && deploy_warn "Нет apps/web-client/dist"
[[ ! -d apps/public-site/.next ]] && need_rebuild=1 && deploy_warn "Нет apps/public-site/.next"
[[ ! -d apps/widget/dist ]] && need_rebuild=1 && deploy_warn "Нет apps/widget/dist"

if [[ "${need_rebuild}" -eq 1 ]]; then
  deploy_log "Пересборка отсутствующих компонентов..."
  deploy_export_frontend_env
  if deploy_npm_deps_healthy; then
    npm run build -w @ai-consultant/shared-types 2>/dev/null || true
    [[ ! -d apps/web-client/dist ]] && VITE_BASE_PATH=/app/ npm run build -w @ai-consultant/web-client || true
    [[ ! -d apps/web-admin/dist ]] && VITE_BASE_PATH=/admin/ npm run build -w @ai-consultant/web-admin || true
    [[ ! -d apps/public-site/.next ]] && NODE_ENV=production npm run build -w @ai-consultant/public-site || true
    [[ ! -d apps/widget/dist ]] && npm run build -w @ai-consultant/widget || true
  else
    deploy_warn "node_modules повреждён — запустите: sudo bash scripts/fix-npm-install.sh"
  fi
fi

# 4. Поднять все фронт-сервисы
deploy_log "Запуск фронт-сервисов..."
for unit in monstro-widget monstro-web-client monstro-web-admin monstro-public-site; do
  deploy_ensure_service "${unit}" || deploy_warn "Не удалось start ${unit}"
done

sleep 3

# 5. Nginx
deploy_log "Перезапуск nginx..."
if nginx -t 2>/dev/null; then
  systemctl enable nginx 2>/dev/null || true
  systemctl restart nginx
else
  deploy_warn "nginx -t FAILED — пробуем перегенерировать конфиг"
  if [[ -f scripts/lib/nginx-redflow.sh ]]; then
    # shellcheck source=lib/nginx-redflow.sh
    source scripts/lib/nginx-redflow.sh
    redflow_nginx_apply redflow.ru 2>/dev/null || deploy_warn "Не удалось применить nginx конфиг"
  fi
fi

# 6. Проверка
sleep 2
echo ""
deploy_log "=== РЕЗУЛЬТАТ ==="
failed=0
deploy_verify_frontends || failed=1

api_code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:3000/api/health 2>/dev/null || echo 000)"
echo "  API health:     HTTP ${api_code}"
echo "  Сайт :4321:     $(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:4321/ 2>/dev/null || echo 000)"
echo "  Админка :5174:  $(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:5174/admin/ 2>/dev/null || echo 000)"
echo "  ЛК :5173:       $(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:5173/app/ 2>/dev/null || echo 000)"

if [[ "${failed}" -eq 0 && "${api_code}" == "200" ]]; then
  echo ""
  echo "  ✓ Сервисы подняты. Проверьте https://redflow.ru/ и https://redflow.ru/admin/"
else
  echo ""
  echo "  ✗ Часть сервисов ещё не отвечает. Логи:"
  echo "    journalctl -u monstro-web-admin -n 30 --no-pager"
  echo "    journalctl -u monstro-public-site -n 30 --no-pager"
  echo "    docker compose logs --tail 30 api"
  exit 1
fi
