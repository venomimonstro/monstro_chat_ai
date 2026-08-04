#!/usr/bin/env bash
# Быстрое обновление AI-виджета (embed.js + iframe) после git pull
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/monstro_chat_ai}"
cd "${INSTALL_DIR}"

[[ "${EUID:-$(id -u)}" -eq 0 ]] || {
  echo "Запустите: sudo bash scripts/redeploy-widget.sh" >&2
  exit 1
}

echo "==> git pull origin main"
git fetch origin main
git checkout main
git reset --hard origin/main
echo "Коммит: $(git log -1 --oneline)"

echo "==> Пересборка виджета"
bash "${INSTALL_DIR}/scripts/lib/build-widget.sh"

echo ""
echo "==> Проверка"
html=$(curl -sf http://127.0.0.1:5175/iframe/index.html)
if echo "${html}" | grep -qE '/iframe/assets/|/assets/'; then
  asset=$(echo "${html}" | grep -oE '(/iframe)?/assets/[^" ]+\.js' | head -1)
  code=$(curl -sf -o /dev/null -w "%{http_code}" "http://127.0.0.1:5175${asset}")
  if [[ "${code}" == "200" ]]; then
    echo "OK: iframe JS доступен (${asset})"
  else
    echo "FAIL: ${asset} → HTTP ${code}" >&2
    exit 1
  fi
else
  echo "FAIL: iframe/index.html не содержит путей к assets" >&2
  exit 1
fi

echo "Готово. Виджет: http://$(curl -4 -s --max-time 3 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}'):5175/embed.js"
