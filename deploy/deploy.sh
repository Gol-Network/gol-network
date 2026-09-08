#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
test -f .env.production || { echo '.env.production is required' >&2; exit 1; }
test -n "${RELEASE_COMMIT:-}" || { echo 'RELEASE_COMMIT is required' >&2; exit 1; }
test "$(git rev-parse HEAD)" = "$RELEASE_COMMIT" || { echo 'checkout does not match RELEASE_COMMIT' >&2; exit 1; }

if docker compose ps --status running worker | grep -q worker; then
  docker compose stop -t 45 worker
fi
if docker compose ps --status running postgres | grep -q postgres; then
  ./backup-db.sh pre-deploy
else
  docker compose up -d postgres
fi
docker compose build --pull web worker
docker compose run --rm migrate
docker compose up -d postgres web worker caddy
docker compose exec -T web node -e "fetch('http://127.0.0.1:3000/api/health').then(async r=>{console.log(await r.text());if(!r.ok)process.exit(1)})"
docker compose ps
