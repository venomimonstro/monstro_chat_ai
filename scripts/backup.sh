#!/usr/bin/env bash
set -euo pipefail

OUTPUT_PATH="${1:-./backups/manual.sql.gz}"
DATABASE_URL="${DATABASE_URL:-postgresql://aicw:aicw_dev_password@localhost:5432/aicw}"

mkdir -p "$(dirname "$OUTPUT_PATH")"
pg_dump "$DATABASE_URL" | gzip > "$OUTPUT_PATH"
echo "Backup saved to $OUTPUT_PATH"
