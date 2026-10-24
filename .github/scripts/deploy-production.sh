#!/usr/bin/env bash
set -euo pipefail

if [[ "${GITHUB_REF:-}" != "refs/heads/main" ]]; then
  echo "Production deployment is allowed from main only." >&2
  exit 1
fi

if [[ -z "${GITHUB_SHA:-}" ]]; then
  echo "GITHUB_SHA is required; run this script from the production workflow." >&2
  exit 1
fi

SRC="$(git rev-parse --show-toplevel)"
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/talentscope/talentscope-UI}"
APP_DIR="$DEPLOY_ROOT/ui"
ENV_FILE="$DEPLOY_ROOT/.env.azure"
COMPOSE_FILE="$DEPLOY_ROOT/docker-compose.azure.yml"
SERVICE=ui
IMAGE=talentscope-ui:latest
ROLLBACK_IMAGE=talentscope-ui:production-rollback
SHA="${GITHUB_SHA:0:12}"
CANDIDATE_IMAGE="talentscope-ui:deploy-$SHA"
LOCK_FILE=/tmp/talentscope-production-deploy.lock

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Another TalentScope production deployment is running; retry after it finishes." >&2
  exit 1
fi

[[ -f "$ENV_FILE" ]] || { echo "Missing production environment file: $ENV_FILE" >&2; exit 1; }
[[ -f "$COMPOSE_FILE" ]] || { echo "Missing production Compose file: $COMPOSE_FILE" >&2; exit 1; }
[[ -f "$DEPLOY_ROOT/.env.example" ]] || { echo "Missing $DEPLOY_ROOT/.env.example required by the UI Docker build." >&2; exit 1; }
[[ -f "$DEPLOY_ROOT/python/vendor/skill_match_entry.ts" ]] || {
  echo "The API repository must be deployed first; missing python/vendor/skill_match_entry.ts." >&2
  exit 1
}

COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
cd "$DEPLOY_ROOT"
"${COMPOSE[@]}" config --services | grep -Fxq "$SERVICE" || {
  echo "Compose service '$SERVICE' was not found in $COMPOSE_FILE." >&2
  exit 1
}
"${COMPOSE[@]}" config --images | grep -Fxq "$IMAGE" || {
  echo "Compose service '$SERVICE' must use image $IMAGE." >&2
  exit 1
}

echo "== Sync UI $SHA -> $APP_DIR"
sudo mkdir -p "$APP_DIR"
sudo chown -R "$(id -un):$(id -gn)" "$APP_DIR"
rsync -a --delete --checksum \
  --exclude='/.env*' --exclude='/.git/' --exclude='/.github/' \
  --exclude='/node_modules/' --exclude='/.next/' \
  "$SRC/" "$APP_DIR/"

PREVIOUS_CONTAINER="$("${COMPOSE[@]}" ps -q "$SERVICE")"
PREVIOUS_IMAGE_REF=""
if [[ -n "$PREVIOUS_CONTAINER" ]]; then
  PREVIOUS_IMAGE_ID="$(docker inspect --format='{{.Image}}' "$PREVIOUS_CONTAINER")"
  PREVIOUS_IMAGE_REF="$(docker inspect --format='{{.Config.Image}}' "$PREVIOUS_CONTAINER")"
  docker image tag "$PREVIOUS_IMAGE_ID" "$ROLLBACK_IMAGE"
fi

echo "== Build UI image"
if ! docker build \
  --file "$APP_DIR/Dockerfile" \
  --build-arg BACKEND_URL=http://python:8000 \
  --tag "$CANDIDATE_IMAGE" \
  "$DEPLOY_ROOT"; then
  echo "UI image build failed; the running service was not changed." >&2
  exit 1
fi
docker image tag "$CANDIDATE_IMAGE" "$IMAGE"

healthy() {
  for _ in $(seq 1 60); do
    local code
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 http://127.0.0.1:3000/ || true)"
    [[ "$code" == "200" ]] && return 0
    sleep 3
  done
  return 1
}

rollback() {
  if [[ -z "$PREVIOUS_IMAGE_REF" ]]; then
    echo "No prior UI container was available to roll back to." >&2
    return 1
  fi
  echo "== Restoring previous UI image"
  docker image tag "$ROLLBACK_IMAGE" "$PREVIOUS_IMAGE_REF"
  "${COMPOSE[@]}" up -d --no-deps --force-recreate --no-build "$SERVICE"
  if healthy; then
    echo "Previous UI version restored."
    return 0
  fi
  echo "Previous UI version did not become healthy; inspect the container logs." >&2
  return 1
}

if ! "${COMPOSE[@]}" up -d --no-deps --force-recreate --no-build "$SERVICE"; then
  echo "UI container recreation failed." >&2
  if ! rollback; then
    echo "Automatic UI rollback failed; manual intervention is required." >&2
  fi
  exit 1
fi

if ! healthy; then
  echo "UI health check failed; recent logs follow." >&2
  if ! "${COMPOSE[@]}" logs --tail=80 "$SERVICE"; then
    echo "Could not retrieve UI container logs." >&2
  fi
  if ! rollback; then
    echo "Automatic UI rollback failed; manual intervention is required." >&2
  fi
  exit 1
fi

if ! curl -fsS -o /dev/null -w "https://talentscope.infinite.com -> %{http_code}\n" \
  --resolve talentscope.infinite.com:443:127.0.0.1 https://talentscope.infinite.com/; then
  echo "Production URL verification failed; recent logs follow." >&2
  if ! "${COMPOSE[@]}" logs --tail=80 "$SERVICE"; then
    echo "Could not retrieve UI container logs." >&2
  fi
  if ! rollback; then
    echo "Automatic UI rollback failed; manual intervention is required." >&2
  fi
  exit 1
fi
if ! printf '%s\n' "$SHA" > "$DEPLOY_ROOT/DEPLOYED_COMMIT-ui"; then
  echo "Warning: could not write the UI deployment marker." >&2
fi
if ! docker image rm "$CANDIDATE_IMAGE" >/dev/null; then
  echo "Warning: could not remove candidate image $CANDIDATE_IMAGE." >&2
fi
if [[ -n "$PREVIOUS_IMAGE_REF" ]]; then
  docker image rm "$ROLLBACK_IMAGE" >/dev/null || echo "Warning: could not remove rollback image $ROLLBACK_IMAGE." >&2
fi
echo "== UI deployment OK: $SHA is live"
