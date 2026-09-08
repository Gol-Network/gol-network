#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
backup_uri="${1:?usage: restore-db.sh s3://bucket/key.sql.gz [gol_restore_name]}"
restore_db="${2:-gol_restore_verify}"
[[ "$backup_uri" == s3://*.sql.gz ]] || { echo 'backup must be an s3 sql.gz URI' >&2; exit 1; }
[[ "$restore_db" == gol_restore_* ]] || { echo 'restore database name must start with gol_restore_' >&2; exit 1; }

docker compose exec -T postgres psql -U gol_admin -d postgres -v ON_ERROR_STOP=1 \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${restore_db}' AND pid <> pg_backend_pid();" \
  -c "DROP DATABASE IF EXISTS \"${restore_db}\";" \
  -c "CREATE DATABASE \"${restore_db}\";"
aws s3 cp "$backup_uri" - --only-show-errors \
  | gzip -d \
  | docker compose exec -T postgres psql -U gol_admin -d "$restore_db" -v ON_ERROR_STOP=1
docker compose exec -T postgres psql -U gol_admin -d "$restore_db" -Atc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"
