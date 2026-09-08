#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
test -n "${GOL_BACKUP_BUCKET:-}" || { echo 'GOL_BACKUP_BUCKET is required' >&2; exit 1; }
test -n "${GOL_BACKUP_KMS_KEY_ID:-}" || { echo 'GOL_BACKUP_KMS_KEY_ID is required' >&2; exit 1; }
label="${1:-daily}"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
key="postgres/${stamp}-${label}.sql.gz"

docker compose exec -T postgres pg_dump -U gol_admin -d gol --no-owner --no-privileges \
  | gzip -9 \
  | aws s3 cp - "s3://${GOL_BACKUP_BUCKET}/${key}" \
      --sse aws:kms --sse-kms-key-id "$GOL_BACKUP_KMS_KEY_ID" --only-show-errors
echo "s3://${GOL_BACKUP_BUCKET}/${key}"
