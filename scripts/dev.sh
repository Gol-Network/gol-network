#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

pnpm langgraph:dev &
langgraph_pid=$!
worker_pid=''

if [ -f "$repo_root/web/.env.local" ] \
  && grep -q '^DATABASE_URL=.' "$repo_root/web/.env.local" \
  && grep -q '^ARC_RPC_URL=.' "$repo_root/web/.env.local"; then
  (
    cd "$repo_root/agent"
    exec node --env-file=../web/.env.local --import=tsx src/payment/worker-entry.ts
  ) &
  worker_pid=$!
fi

cleanup() {
  trap - EXIT INT TERM
  kill "$langgraph_pid" >/dev/null 2>&1 || true
  if [ -n "$worker_pid" ]; then
    kill "$worker_pid" >/dev/null 2>&1 || true
  fi
  wait "$langgraph_pid" >/dev/null 2>&1 || true
  if [ -n "$worker_pid" ]; then
    wait "$worker_pid" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

pnpm --filter @gol/web dev
