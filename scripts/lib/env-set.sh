#!/usr/bin/env bash
# Helpers for idempotent .env updates
set -euo pipefail

ENV_FILE="${ENV_FILE:-${INSTALL_DIR}/.env}"

env_set() {
  local key="$1"
  local value="$2"
  if grep -qE "^${key}=" "${ENV_FILE}" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${value}|" "${ENV_FILE}"
  else
    echo "${key}=${value}" >> "${ENV_FILE}"
  fi
}

env_set_if_missing() {
  local key="$1"
  local value="$2"
  if ! grep -qE "^${key}=" "${ENV_FILE}" 2>/dev/null; then
    echo "${key}=${value}" >> "${ENV_FILE}"
  fi
}

env_get() {
  local key="$1"
  grep -E "^${key}=" "${ENV_FILE}" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'"
}

env_uncomment() {
  local key="$1"
  sed -i "s|^#\s*${key}=|${key}=|" "${ENV_FILE}" 2>/dev/null || true
}
