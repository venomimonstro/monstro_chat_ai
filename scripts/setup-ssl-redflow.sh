#!/usr/bin/env bash
# SSL + nginx для redflow.ru на Beget VPS
# Usage: sudo bash scripts/setup-ssl-redflow.sh
#
# Перед запуском в панели Beget:
#   A-запись redflow.ru → 31.128.42.106
#   A-запись www.redflow.ru → 31.128.42.106
set -euo pipefail

DOMAIN="${DOMAIN:-redflow.ru}"
WWW="${WWW_DOMAIN:-www.redflow.ru}"
SERVER_IP="${SERVER_IP:-31.128.42.106}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/resolve-install-dir.sh
source "${SCRIPT_DIR}/lib/resolve-install-dir.sh"

log()  { echo -e "\n\033[1;32m==>\033[0m $*"; }
warn() { echo -e "\033[1;33m!!\033[0m $*"; }
fail() { echo -e "\033[1;31mERROR:\033[0m $*" >&2; exit 1; }

[[ "${EUID:-$(id -u)}" -eq 0 ]] || fail "Запустите от root"

log "RedFlow — настройка nginx + SSL для ${DOMAIN}"

apt-get update -qq
apt-get install -y -qq nginx certbot python3-certbot-nginx curl dnsutils

log "Проверка DNS ${DOMAIN}..."
RESOLVED=$(dig +short "${DOMAIN}" @8.8.8.8 | tail -1)
if [[ "${RESOLVED}" != "${SERVER_IP}" ]]; then
  warn "DNS ${DOMAIN} → ${RESOLVED:-?} (ожидался ${SERVER_IP})"
  warn "Дождитесь обновления DNS в Beget, затем повторите certbot"
fi

NGINX_SITE="/etc/nginx/sites-available/redflow.conf"
cat > "${NGINX_SITE}" << EOF
map \$http_upgrade \$connection_upgrade {
  default upgrade;
  '' close;
}

server {
  listen 80;
  listen [::]:80;
  server_name ${DOMAIN} ${WWW};

  location /.well-known/acme-challenge/ { root /var/www/html; }

  location /api/ {
    proxy_pass http://127.0.0.1:3000/api/;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }

  location /socket.io/ {
    proxy_pass http://127.0.0.1:3000/socket.io/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection \$connection_upgrade;
    proxy_set_header Host \$host;
  }

  location /widget/ {
    proxy_pass http://127.0.0.1:5175/;
    proxy_set_header Host \$host;
  }

  location /embed.js {
    proxy_pass http://127.0.0.1:5175/embed.js;
    proxy_set_header Host \$host;
  }

  location /admin/ {
    proxy_pass http://127.0.0.1:5174/;
    proxy_set_header Host \$host;
  }

  location /app/ {
    proxy_pass http://127.0.0.1:5173/;
    proxy_set_header Host \$host;
  }

  location / {
    proxy_pass http://127.0.0.1:4321;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }
}
EOF

ln -sf "${NGINX_SITE}" /etc/nginx/sites-enabled/redflow.conf
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
nginx -t
systemctl enable nginx
systemctl reload nginx

log "Получение SSL-сертификата Let's Encrypt..."
certbot --nginx -d "${DOMAIN}" -d "${WWW}" --non-interactive --agree-tos \
  -m "admin@${DOMAIN}" --redirect || {
  warn "Certbot не смог выпустить сертификат — проверьте DNS и повторите:"
  warn "  certbot --nginx -d ${DOMAIN} -d ${WWW}"
}

log "Автонастройка .env для ${DOMAIN}..."
bash "${INSTALL_DIR}/scripts/apply-redflow-env.sh"

log "Пересборка с production URL..."
bash "${INSTALL_DIR}/scripts/fast-update.sh" --full --no-pull

log "Проверка RedFlow..."
bash "${INSTALL_DIR}/scripts/verify-redflow.sh" || warn "Есть предупреждения — см. выше"

log "Готово: https://${DOMAIN}/admin/sprints"
