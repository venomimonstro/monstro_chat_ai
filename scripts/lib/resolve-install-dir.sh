#!/usr/bin/env bash
# Resolve the project install directory.
# Prefers /opt/redflow, then /opt/monstro_chat_ai, then script's parent.
set -euo pipefail

if [[ -z "${INSTALL_DIR:-}" ]]; then
  if [[ -d /opt/redflow ]] && [[ -f /opt/redflow/package.json ]]; then
    INSTALL_DIR="/opt/redflow"
  elif [[ -d /opt/monstro_chat_ai ]] && [[ -f /opt/monstro_chat_ai/package.json ]]; then
    INSTALL_DIR="/opt/monstro_chat_ai"
  else
    INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  fi
  export INSTALL_DIR
fi
