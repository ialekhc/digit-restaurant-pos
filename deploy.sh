#!/usr/bin/env bash

set -Eeuo pipefail

PROJECT_DIR="/home/alekh/digit-restaurant-pos"
BRANCH="main"

cd "$PROJECT_DIR"

COMPOSE=(docker compose)
if [ -f "$PROJECT_DIR/.env.postgres" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$PROJECT_DIR/.env.postgres"
  set +a
  COMPOSE+=(--env-file "$PROJECT_DIR/.env.postgres")
fi

echo "==> Checking repository"
git fetch origin "$BRANCH"

echo "==> Backing up PostgreSQL"
mkdir -p "$PROJECT_DIR/backups"

BACKUP_FILE="$PROJECT_DIR/backups/restaurant_pos_$(date +%Y%m%d_%H%M%S).sql"

docker exec digit-pos-postgres \
  pg_dump -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-restaurant_pos}" \
  > "$BACKUP_FILE"

if [ ! -s "$BACKUP_FILE" ]; then
  echo "Database backup failed or produced an empty file."
  exit 1
fi

echo "==> Updating application code"
git reset --hard "origin/$BRANCH"

echo "==> Building application containers only"
"${COMPOSE[@]}" build backend frontend

echo "==> Running database migrations"
"${COMPOSE[@]}" run --rm backend npm run db:migrate

echo "==> Replacing application containers only"
"${COMPOSE[@]}" up -d --no-deps backend frontend

echo "==> Waiting for services"
sleep 10

echo "==> Checking backend"
curl --fail --silent --show-error \
  http://127.0.0.1:5500/api/health >/dev/null

echo "==> Checking frontend"
curl --fail --silent --show-error \
  http://127.0.0.1:3005 >/dev/null

echo "==> Checking Nginx"
sudo nginx -t
sudo systemctl reload nginx

echo "==> Checking public website"
curl --fail --silent --show-error \
  https://digitnp.com >/dev/null

echo "Deployment completed successfully."
echo "Database backup: $BACKUP_FILE"
