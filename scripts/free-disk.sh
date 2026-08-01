#!/usr/bin/env bash
# Освободить место на диске перед Docker-сборкой
set -euo pipefail

log() { echo -e "\n\033[1;32m==>\033[0m $*"; }

log "Диск ДО очистки:"
df -h /

log "Останавливаю контейнеры..."
docker compose -f /opt/monstro_chat_ai/docker-compose.yml down 2>/dev/null || true

log "Очищаю Docker (образы, кэш сборки, неиспользуемое)..."
docker system prune -af 2>/dev/null || true
docker builder prune -af 2>/dev/null || true
docker volume prune -f 2>/dev/null || true

log "Удаляю node_modules на хосте..."
rm -rf /opt/monstro_chat_ai/node_modules
rm -rf /opt/monstro_chat_ai/apps/*/node_modules
rm -rf /opt/monstro_chat_ai/packages/*/node_modules

log "Очищаю apt и логи..."
apt-get autoremove -y -qq 2>/dev/null || true
apt-get clean 2>/dev/null || true
journalctl --vacuum-size=50M 2>/dev/null || true

log "Диск ПОСЛЕ очистки:"
df -h /

FREE_GB=$(df -BG / | awk 'NR==2 {gsub(/G/,"",$4); print $4}')
if [[ "${FREE_GB:-0}" -lt 3 ]]; then
  echo ""
  echo "!! Мало места (${FREE_GB}G свободно). Нужно минимум 3-5 GB для сборки."
  echo "!! Увеличьте диск в панели хостинга или удалите лишние файлы."
fi
