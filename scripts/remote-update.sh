#!/usr/bin/env bash
# Полное обновление (обёртка над fast-update --full)
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/monstro_chat_ai}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log()  { echo -e "\n\033[1;32m==>\033[0m $*"; }
fail() { echo -e "\033[1;31mERROR:\033[0m $*" >&2; exit 1; }

[[ "${EUID:-$(id -u)}" -eq 0 ]] || fail "Запустите от root: sudo bash scripts/remote-update.sh"

ensure_swap() {
  local swap_kb
  swap_kb=$(awk '/^SwapTotal:/ {print $2}' /proc/meminfo 2>/dev/null || echo 0)
  if [[ "${swap_kb:-0}" -lt 1048576 ]]; then
    log "Добавляю swap 2G..."
    if [[ ! -f /swapfile ]]; then
      fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
      chmod 600 /swapfile
      mkswap /swapfile
      swapon /swapfile
      grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
    else
      swapon /swapfile 2>/dev/null || true
    fi
  fi
}

ensure_disk_space() {
  if [[ -f "${INSTALL_DIR}/scripts/free-disk.sh" ]]; then
    log "Проверяю свободное место..."
    bash "${INSTALL_DIR}/scripts/free-disk.sh" || fail "Недостаточно места на диске"
  fi
}

log "Monstro Chat AI — remote update (full)"
ensure_swap

if [[ ! -f "${INSTALL_DIR}/scripts/fast-update.sh" ]]; then
  REPO_URL="${REPO_URL:-https://github.com/venomimonstro/monstro_chat_ai.git}"
  BRANCH="${BRANCH:-main}"
  apt-get install -y -qq git 2>/dev/null || true
  if [[ ! -d "${INSTALL_DIR}/.git" ]]; then
    git clone --branch "${BRANCH}" "${REPO_URL}" "${INSTALL_DIR}"
  fi
fi

ensure_disk_space
exec bash "${SCRIPT_DIR}/fast-update.sh" --full "$@"
