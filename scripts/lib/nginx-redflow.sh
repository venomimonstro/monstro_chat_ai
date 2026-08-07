#!/usr/bin/env bash
# Генерация nginx-конфига RedFlow (HTTP + HTTPS если есть сертификаты)
set -euo pipefail

redflow_nginx_write_config() {
  local domain="${1:-redflow.ru}"
  local www="${2:-www.${domain}}"
  local out="${3:-/etc/nginx/sites-available/redflow.conf}"
  local cert_dir="/etc/letsencrypt/live/${domain}"
  local has_ssl=0

  if [[ -f "${cert_dir}/fullchain.pem" && -f "${cert_dir}/privkey.pem" ]]; then
    has_ssl=1
  fi

  local locations ssl_extra=""
  locations="$(redflow_nginx_locations_block)"

  if [[ "${has_ssl}" -eq 1 ]]; then
    [[ -f /etc/letsencrypt/options-ssl-nginx.conf ]] && ssl_extra+="  include /etc/letsencrypt/options-ssl-nginx.conf;"$'\n'
    [[ -f /etc/letsencrypt/ssl-dhparams.pem ]] && ssl_extra+="  ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;"$'\n'

    cat > "${out}" << EOF
# RedFlow — ${domain} (auto-generated, SSL enabled)
map \$http_upgrade \$connection_upgrade {
  default upgrade;
  '' close;
}

server {
  listen 80;
  listen [::]:80;
  server_name ${domain} ${www};
  location /.well-known/acme-challenge/ { root /var/www/html; }
  location / { return 301 https://\$host\$request_uri; }
}

server {
  listen 443 ssl http2;
  listen [::]:443 ssl http2;
  server_name ${domain} ${www};

  ssl_certificate ${cert_dir}/fullchain.pem;
  ssl_certificate_key ${cert_dir}/privkey.pem;
${ssl_extra}
${locations}
}
EOF
  else
    cat > "${out}" << EOF
# RedFlow — ${domain} (auto-generated, HTTP only — run certbot for SSL)
map \$http_upgrade \$connection_upgrade {
  default upgrade;
  '' close;
}

server {
  listen 80;
  listen [::]:80;
  server_name ${domain} ${www};

${locations}
}
EOF
  fi
}

redflow_nginx_locations_block() {
  cat << 'NGINX'
  client_max_body_size 32m;
  proxy_connect_timeout 15s;
  proxy_send_timeout 120s;
  proxy_read_timeout 120s;

  location /.well-known/acme-challenge/ { root /var/www/html; }

  location /api/ {
    proxy_pass http://127.0.0.1:3000/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /socket.io/ {
    proxy_pass http://127.0.0.1:3000/socket.io/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 86400s;
    proxy_send_timeout 86400s;
  }

  location /embed.js {
    proxy_pass http://127.0.0.1:5175/embed.js;
    proxy_set_header Host $host;
    add_header Access-Control-Allow-Origin *;
  }

  location /iframe/ {
    proxy_pass http://127.0.0.1:5175/iframe/;
    proxy_set_header Host $host;
    add_header Access-Control-Allow-Origin *;
  }

  location /widget/ {
    proxy_pass http://127.0.0.1:5175/;
    proxy_set_header Host $host;
    add_header Access-Control-Allow-Origin *;
  }

  location = /admin { return 301 /admin/; }
  location /admin/ {
    proxy_pass http://127.0.0.1:5174/admin/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location = /app { return 301 /app/; }
  location /app/ {
    proxy_pass http://127.0.0.1:5173/app/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location / {
    proxy_pass http://127.0.0.1:4321;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
NGINX
}

redflow_nginx_apply() {
  local domain="${1:-redflow.ru}"
  local www="${2:-www.${domain}}"
  local site="/etc/nginx/sites-available/redflow.conf"

  # shellcheck source=open-firewall.sh
  if [[ -f "$(dirname "${BASH_SOURCE[0]}")/open-firewall.sh" ]]; then
    # shellcheck source=open-firewall.sh
    source "$(dirname "${BASH_SOURCE[0]}")/open-firewall.sh"
    open_redflow_firewall
  fi

  redflow_nginx_write_config "${domain}" "${www}" "${site}"
  ln -sf "${site}" /etc/nginx/sites-enabled/redflow.conf
  rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
  nginx -t
  systemctl enable nginx
  systemctl restart nginx
}

redflow_nginx_open_firewall() {
  if command -v ufw >/dev/null 2>&1; then
    ufw allow 80/tcp >/dev/null 2>&1 || true
    ufw allow 443/tcp >/dev/null 2>&1 || true
    ufw reload >/dev/null 2>&1 || true
  fi
}
