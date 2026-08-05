#!/usr/bin/env bash
# Единое определение INSTALL_DIR (RedFlow + legacy fallback)
if [[ -z "${INSTALL_DIR:-}" ]]; then
  if [[ -d /opt/redflow ]]; then
    INSTALL_DIR=/opt/redflow
  elif [[ -d /opt/monstro_chat_ai ]]; then
    INSTALL_DIR=/opt/monstro_chat_ai
  else
    INSTALL_DIR=/opt/redflow
  fi
fi
export INSTALL_DIR
