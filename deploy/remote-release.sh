#!/usr/bin/env bash
set -euo pipefail

release_commit="${1:-}"
repo_dir="${GOL_REPO_DIR:-/opt/gol-network}"

if [[ ! "$release_commit" =~ ^[0-9a-f]{40}$ ]]; then
  echo 'a full lowercase release commit is required' >&2
  exit 1
fi
test -d "$repo_dir/.git" || { echo 'production checkout is missing' >&2; exit 1; }
test -f "$repo_dir/deploy/.env.production" || {
  echo 'deploy/.env.production is required on the production host' >&2
  exit 1
}

cd "$repo_dir"
test "$(git rev-parse HEAD)" = "$release_commit" || {
  echo 'production checkout does not match the requested release' >&2
  exit 1
}
test -z "$(git status --porcelain)" || {
  echo 'production checkout is not clean' >&2
  exit 1
}

# GitHub Actions also serializes production jobs. The host-side lock protects manual invocations.
exec 9>/tmp/gol-production-deploy.lock
flock -n 9 || { echo 'another production deployment is already running' >&2; exit 1; }

export RELEASE_COMMIT="$release_commit"
: "${GOL_BACKUP_BUCKET:=gol-production-779035457064-ap-northeast-1}"
: "${GOL_BACKUP_KMS_KEY_ID:=alias/gol-backups}"
export GOL_BACKUP_BUCKET GOL_BACKUP_KMS_KEY_ID

exec ./deploy/deploy.sh
