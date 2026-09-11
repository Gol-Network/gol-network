#!/usr/bin/env bash
set -euo pipefail

repo_dir="${GOL_REPO_DIR:-/opt/gol-network}"
runs_url='https://api.github.com/repos/Gol-Network/gol-network/actions/workflows/deploy-production.yml/runs?branch=main&status=completed&per_page=5'

test -d "$repo_dir/.git" || { echo 'production checkout is missing' >&2; exit 1; }
test -f "$repo_dir/deploy/.env.production" || {
  echo 'deploy/.env.production is required on the production host' >&2
  exit 1
}

exec 9>/tmp/gol-production-release-poller.lock
flock -n 9 || exit 0

api_get() {
  curl --fail --show-error --silent \
    --retry 3 --retry-all-errors --retry-delay 2 \
    -H 'Accept: application/vnd.github+json' \
    -H 'X-GitHub-Api-Version: 2022-11-28' \
    -H 'User-Agent: gol-production-release-poller' \
    "$1"
}

runs_json="$(api_get "$runs_url")"
release_record="$(
  python3 -c '
import json, sys
runs = json.load(sys.stdin).get("workflow_runs", [])
run = next((item for item in runs if item.get("conclusion") == "success"), None)
if run:
    print(run.get("id", ""), run.get("head_sha", ""))
' <<<"$runs_json"
)"
test -n "$release_record" || { echo 'no successful release run found'; exit 0; }
read -r run_id release_commit <<<"$release_record"

[[ "${run_id:-}" =~ ^[0-9]+$ ]] || { echo 'release run id is invalid' >&2; exit 1; }
[[ "${release_commit:-}" =~ ^[0-9a-f]{40}$ ]] || {
  echo 'release run did not provide a full commit' >&2
  exit 1
}

jobs_json="$(api_get "https://api.github.com/repos/Gol-Network/gol-network/actions/runs/$run_id/jobs")"
release_job_conclusion="$(
  python3 -c '
import json, sys
jobs = json.load(sys.stdin).get("jobs", [])
job = next((item for item in jobs if item.get("name") == "release"), None)
print(job.get("conclusion", "") if job else "")
' <<<"$jobs_json"
)"
test "$release_job_conclusion" = 'success' || {
  echo "release job $run_id is not approved"
  exit 0
}

cd "$repo_dir"
main_commit="$(git ls-remote --exit-code origin refs/heads/main | awk 'NR == 1 { print $1 }')"
[[ "$main_commit" =~ ^[0-9a-f]{40}$ ]] || { echo 'origin main is invalid' >&2; exit 1; }
test "$main_commit" = "$release_commit" || {
  echo 'latest main commit is still awaiting production approval'
  exit 0
}

deployed_commit="$(
  curl --fail --show-error --silent --max-time 15 https://gol.network/api/health 2>/dev/null |
    python3 -c 'import json, sys; print(json.load(sys.stdin).get("sourceCommit", ""))' 2>/dev/null || true
)"
if test "$deployed_commit" = "$release_commit"; then
  echo "production already runs $release_commit"
  exit 0
fi

test -z "$(git status --porcelain)" || {
  echo 'production checkout is not clean' >&2
  exit 1
}
git fetch --force --prune origin main
test "$(git rev-parse FETCH_HEAD)" = "$release_commit"
git cat-file -e "$release_commit^{commit}"
git checkout --detach "$release_commit"

GOL_REPO_DIR="$repo_dir" \
  GOL_BACKUP_BUCKET=gol-production-779035457064-ap-northeast-1 \
  GOL_BACKUP_KMS_KEY_ID=alias/gol-backups \
  bash "$repo_dir/deploy/remote-release.sh" "$release_commit"

health="$(curl --fail --show-error --silent --retry 12 --retry-all-errors \
  --retry-delay 5 https://gol.network/api/health)"
test "$(python3 -c 'import json, sys; print(json.load(sys.stdin).get("ready", False))' <<<"$health")" = 'True'
test "$(python3 -c 'import json, sys; print(json.load(sys.stdin).get("sourceCommit", ""))' <<<"$health")" = "$release_commit"
echo "production deployed $release_commit"
