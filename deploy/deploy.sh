#!/usr/bin/env bash
# Deploy by rsync'ing source to the server and running docker compose.
# Usage: ./deploy/deploy.sh
set -euo pipefail

HOST="${DEPLOY_HOST:-deploy@162.55.183.68}"
REMOTE_DIR="${DEPLOY_DIR:-/home/deploy/app}"

cd "$(dirname "$0")/.."

ssh "$HOST" "mkdir -p $REMOTE_DIR"

rsync -az --delete \
    --exclude '.git' \
    --exclude 'node_modules' \
    --exclude '.next' \
    --exclude '.venv' \
    --exclude '__pycache__' \
    --exclude '.env' \
    ./ "$HOST:$REMOTE_DIR/"

ssh "$HOST" "cd $REMOTE_DIR && docker compose up -d --build --remove-orphans && docker compose restart caddy && docker image prune -f"
