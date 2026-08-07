#!/usr/bin/env bash
# Ensure API Docker stack is up (postgres, redis, minio, api, migrate)
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/monstro_chat_ai}"

cd "${INSTALL_DIR}"

ensure_api_stack() {
  docker compose up -d postgres redis minio
  echo "==> Жду инфраструктуру..."
  local i
  for i in $(seq 1 30); do
    if docker compose ps postgres redis minio 2>/dev/null | grep -qE 'Up \(healthy\)|Up ' ; then
      break
    fi
    sleep 2
  done
  docker compose up -d --force-recreate api
  echo "==> Жду API..."
  for i in $(seq 1 40); do
    if curl -sf http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
      echo "API OK"
      return 0
    fi
    sleep 3
  done
  echo "ERROR: API не поднялся за 120с" >&2
  docker compose logs --tail 50 api >&2 || true
  return 1
}

ensure_api_stack
