#!/usr/bin/env bash
set -euo pipefail

URL="${1:-http://localhost:3000/api/health}"
ATTEMPTS="${HEALTH_CHECK_ATTEMPTS:-30}"
SLEEP_SEC="${HEALTH_CHECK_SLEEP_SEC:-2}"

for ((i=1; i<=ATTEMPTS; i++)); do
  if curl -fsS "$URL" > /dev/null; then
    echo "Health OK: $URL"
    exit 0
  fi
  echo "Attempt $i/$ATTEMPTS failed, retrying..."
  sleep "$SLEEP_SEC"
done

echo "Health check failed: $URL" >&2
exit 1
