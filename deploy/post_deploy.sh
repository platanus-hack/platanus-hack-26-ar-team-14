#!/usr/bin/env bash
# Bring up the stack on the deploy host, dropping & reseeding the database.
# Run from the repo root on the remote host: `bash deploy/post_deploy.sh`.
set -euo pipefail

PROJECT=$(basename "$PWD")

# Demo environment: drop and recreate the database on every deploy.
docker compose stop postgres backend || true
docker compose rm -f postgres backend || true
docker volume rm "${PROJECT}_postgres_data" 2>/dev/null || true

docker compose up -d --build --remove-orphans
docker image prune -f

# Wait for postgres to become healthy, then give backend a moment to migrate.
for _ in $(seq 1 60); do
    if docker compose exec -T postgres pg_isready -U postgres -d app >/dev/null 2>&1; then
        break
    fi
    sleep 1
done
sleep 5

docker compose exec -T backend python -m scripts.seed_demo
