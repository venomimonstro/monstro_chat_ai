#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:?Usage: blue-green-deploy.sh <version> [image_tag]}"
IMAGE_TAG="${2:-$VERSION}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.blue-green.yml}"
ACTIVE_SLOT="${ACTIVE_SLOT:-blue}"
NEXT_SLOT="green"
if [[ "$ACTIVE_SLOT" == "green" ]]; then NEXT_SLOT="blue"; fi

export APP_VERSION="$VERSION"
export IMAGE_TAG="$IMAGE_TAG"
export DEPLOY_SLOT="$NEXT_SLOT"

echo "Deploying $VERSION to $NEXT_SLOT slot"
docker compose -f "$COMPOSE_FILE" up -d "api-$NEXT_SLOT"

if [[ "$NEXT_SLOT" == "blue" ]]; then
  HEALTH_URL="http://localhost:3000/api/health"
else
  HEALTH_URL="http://localhost:3001/api/health"
fi
bash "$(dirname "$0")/health-check.sh" "$HEALTH_URL"

echo "Switching nginx upstream to $NEXT_SLOT"
export ACTIVE_SLOT="$NEXT_SLOT"
echo "ACTIVE_SLOT=$NEXT_SLOT" > .deploy-state
echo "Blue-green deploy complete"
