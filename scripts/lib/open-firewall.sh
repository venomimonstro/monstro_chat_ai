#!/usr/bin/env bash
# Открыть порты 80/443 (ufw) — нужно для Let's Encrypt и домена
set -euo pipefail

open_redflow_firewall() {
  log() { echo -e "\033[1;32m[firewall]\033[0m $*"; }
  warn() { echo -e "\033[1;33m[firewall]\033[0m $*"; }

  if command -v ufw >/dev/null 2>&1; then
    log "UFW: открываю 22, 80, 443..."
    ufw allow 22/tcp  >/dev/null 2>&1 || true
    ufw allow 80/tcp  >/dev/null 2>&1 || true
    ufw allow 443/tcp >/dev/null 2>&1 || true
    # Старые порты для прямого доступа по IP (опционально)
    ufw allow 3000/tcp >/dev/null 2>&1 || true
    ufw allow 4321/tcp >/dev/null 2>&1 || true
    ufw allow 5173:5175/tcp >/dev/null 2>&1 || true
    ufw --force enable >/dev/null 2>&1 || true
    ufw reload >/dev/null 2>&1 || true
    ufw status numbered 2>/dev/null | head -20 || true
  else
    warn "ufw не установлен — проверьте firewall в панели Beget (TCP 80, 443)"
  fi

  if ss -tlnp 2>/dev/null | grep -q ':80 '; then
    log "nginx слушает :80"
  else
    warn "порт 80 не слушается — запустите nginx"
  fi

  warn "Если certbot всё ещё падает: панель Beget → VPS → Firewall → разрешите TCP 80 и 443"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  open_redflow_firewall
fi
