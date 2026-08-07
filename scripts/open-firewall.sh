#!/usr/bin/env bash
# Открыть порты 80/443 для Let's Encrypt
# Usage: sudo bash scripts/open-firewall.sh
exec bash "$(dirname "$0")/lib/open-firewall.sh"
