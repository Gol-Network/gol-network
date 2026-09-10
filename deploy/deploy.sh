#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
env_file=.env.production
test -f "$env_file" || { echo "$env_file is required" >&2; exit 1; }

# Record the exact source commit that produced this release, or refuse to guess one.
if [ -z "${RELEASE_COMMIT:-}" ]; then
  echo 'RELEASE_COMMIT is required' >&2
  exit 1
fi
test "$(git rev-parse HEAD)" = "$RELEASE_COMMIT" || {
  echo 'checkout does not match RELEASE_COMMIT' >&2
  exit 1
}
if [ -n "$(git status --porcelain)" ]; then
  if [ "${ALLOW_DIRTY_TREE:-0}" != "1" ]; then
    echo 'source tree is not clean; commit changes or set ALLOW_DIRTY_TREE=1 deliberately' >&2
    exit 1
  fi
  echo "warning: deploying a dirty tree at $RELEASE_COMMIT" >&2
fi

read_env() { grep -E "^${1}=" "$env_file" | tail -n 1 | cut -d= -f2- || true; }

# Fail before touching the host when required runtime configuration is absent.
required=(
  DOMAIN
  APP_ORIGIN
  POSTGRES_ADMIN_PASSWORD
  POSTGRES_RUNTIME_PASSWORD
  ARC_RPC_URL
  GRAPH_QUERY_URL
  PRIVY_APP_ID
  PRIVY_APP_SECRET
  PRIVY_VERIFICATION_KEY
  OPENAI_API_KEY
  GOL_AGENT_SHARED_SECRET
  FACTORY_ADDRESS
  AGENT_MAX_GAS
  AGENT_MAX_FEE_PER_GAS
)

# The agent signer provider selects which signer configuration is mandatory.
signer_provider="$(read_env AGENT_SIGNER_PROVIDER)"
signer_provider="${signer_provider:-privy}"
case "$signer_provider" in
  aws_kms)
    required+=(AWS_KMS_SIGNER_KEY_ARN AWS_KMS_SIGNER_REGION AWS_KMS_SIGNER_ADDRESS)
    ;;
  privy)
    required+=(PRIVY_AUTHORIZATION_KEY_ID PRIVY_AUTHORIZATION_PRIVATE_KEY)
    ;;
  *)
    echo "AGENT_SIGNER_PROVIDER must be privy or aws_kms" >&2
    exit 1
    ;;
esac

missing=()
for name in "${required[@]}"; do
  value="$(grep -E "^${name}=" "$env_file" | tail -n 1 | cut -d= -f2- || true)"
  if [ -z "$value" ]; then missing+=("$name"); fi
done
if [ "${#missing[@]}" -gt 0 ]; then
  # Field names only. A configuration value may itself be a secret.
  echo "missing required runtime configuration: ${missing[*]}" >&2
  exit 1
fi

compose() { docker compose --env-file "$env_file" "$@"; }

# The images pin Node 22; refuse to build with anything else installed as the local default.
if command -v node >/dev/null 2>&1; then
  case "$(node --version)" in
    v22.*) ;;
    *) echo "warning: local node $(node --version) differs from the pinned Node 22 build" >&2 ;;
  esac
fi

if compose ps --status running worker | grep -q worker; then
  compose stop -t 45 worker
fi
if compose ps --status running postgres | grep -q postgres; then
  ./backup-db.sh pre-deploy
else
  compose up -d postgres
fi
compose build --pull langgraph-agent web worker
# Migrate before any traffic reaches the new image.
compose run --rm migrate
compose up -d postgres langgraph-agent web worker caddy
compose exec -T web node -e "fetch('http://127.0.0.1:3000/api/health').then(async r=>{console.log(await r.text());if(!r.ok)process.exit(1)})"
compose ps
