#!/usr/bin/env bash
set -euo pipefail

SNAPSHOT_PATH="${1:?Usage: restore.sh <snapshot_path>}"
DATABASE_URL="${DATABASE_URL:-postgresql://aicw:aicw_dev_password@localhost:5432/aicw}"

if [[ ! -f "$SNAPSHOT_PATH" ]]; then
  echo "Snapshot not found: $SNAPSHOT_PATH" >&2
  exit 1
fi

gunzip -c "$SNAPSHOT_PATH" | psql "$DATABASE_URL"
echo "Restored from $SNAPSHOT_PATH"
