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

ssh "$HOST" "REMOTE_DIR=$REMOTE_DIR bash -s" <<'REMOTE'
    set -euo pipefail
    cd "$REMOTE_DIR"
    PROJECT=$(basename "$PWD")

    # Demo environment: drop and recreate the database on every deploy.
    docker compose stop postgres backend || true
    docker compose rm -f postgres backend || true
    docker volume rm "${PROJECT}_postgres_data" 2>/dev/null || true

    docker compose up -d --build --remove-orphans
    docker image prune -f

    for i in $(seq 1 60); do
        docker compose exec -T postgres pg_isready -U postgres -d app >/dev/null 2>&1 && break
        sleep 1
    done
    sleep 5

    docker compose exec -T backend python -m scripts.seed_demo
REMOTE
