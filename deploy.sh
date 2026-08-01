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

POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-restaurant_pos}"

require_postgres_env() {
  if [ -z "$POSTGRES_USER" ] || [ -z "$POSTGRES_PASSWORD" ] || [ -z "$POSTGRES_DB" ]; then
    echo "POSTGRES_USER, POSTGRES_PASSWORD, and POSTGRES_DB are required for production deploy."
    exit 1
  fi
}

wait_for_postgres() {
  echo "==> Waiting for PostgreSQL"
  for attempt in {1..30}; do
    if docker exec digit-pos-postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done

  echo "PostgreSQL did not become healthy in time."
  exit 1
}

sync_postgres_password() {
  echo "==> Synchronizing PostgreSQL credentials"
  docker exec -i \
    -e DB_USER="$POSTGRES_USER" \
    -e DB_PASS="$POSTGRES_PASSWORD" \
    -e DB_NAME="$POSTGRES_DB" \
    digit-pos-postgres \
    sh -lc 'psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -v db_user="$DB_USER" -v db_pass="$DB_PASS" <<SQL
SELECT format('\''ALTER USER %I WITH PASSWORD %L'\'', :'\''db_user'\'', :'\''db_pass'\'') \gexec
SQL'
}

require_postgres_env

echo "==> Checking repository"
git fetch origin "+${BRANCH}:refs/remotes/origin/${BRANCH}"

echo "==> Updating application code"
git reset --hard "origin/$BRANCH"

echo "==> Ensuring PostgreSQL is running"
"${COMPOSE[@]}" up -d postgres
wait_for_postgres
sync_postgres_password

echo "==> Backing up PostgreSQL"
mkdir -p "$PROJECT_DIR/backups"

BACKUP_FILE="$PROJECT_DIR/backups/restaurant_pos_$(date +%Y%m%d_%H%M%S).sql"

docker exec digit-pos-postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  > "$BACKUP_FILE"

if [ ! -s "$BACKUP_FILE" ]; then
  echo "Database backup failed or produced an empty file."
  exit 1
fi

echo "==> Building application containers only"
"${COMPOSE[@]}" build backend frontend

echo "==> Running database migrations"
"${COMPOSE[@]}" run --rm backend npm run db:migrate

echo "==> Running production database sync"
"${COMPOSE[@]}" run --rm backend npm run production:db:sync

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
