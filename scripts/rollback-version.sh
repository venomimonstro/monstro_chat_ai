#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:?Usage: rollback-version.sh <version>}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.blue-green.yml}"
ACTIVE_SLOT="${ACTIVE_SLOT:-blue}"
NEXT_SLOT="green"
if [[ "$ACTIVE_SLOT" == "green" ]]; then NEXT_SLOT="blue"; fi

echo "Rolling back to version $VERSION on slot $NEXT_SLOT"
export APP_VERSION="$VERSION"
export DEPLOY_SLOT="$NEXT_SLOT"
docker compose -f "$COMPOSE_FILE" up -d "api-$NEXT_SLOT"
bash "$(dirname "$0")/health-check.sh" "http://localhost:3000/api/health"
echo "Rollback complete"
