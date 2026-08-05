#!/usr/bin/env bash
# Безопасная запись переменных в .env (не трогает остальные ключи)
set -euo pipefail

env_set() {
  local key="$1"
  local value="$2"
  local file="${ENV_FILE:-.env}"

  if [[ ! -f "${file}" ]]; then
    touch "${file}"
  fi

  grep -v "^${key}=" "${file}" > "${file}.tmp" 2>/dev/null || true
  printf '%s=%s\n' "${key}" "${value}" >> "${file}.tmp"
  mv "${file}.tmp" "${file}"
}

env_set_if_missing() {
  local key="$1"
  local value="$2"
  local file="${ENV_FILE:-.env}"

  if [[ -f "${file}" ]] && grep -q "^${key}=" "${file}"; then
    return 0
  fi
  env_set "${key}" "${value}"
}

env_get() {
  local key="$1"
  local file="${ENV_FILE:-.env}"
  if [[ ! -f "${file}" ]]; then
    return 1
  fi
  grep -E "^${key}=" "${file}" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'"
}
