#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
env_args=()
if [ -f "$repo_root/web/.env.local" ]; then
  # Next.js already reads this file. Loading it here gives local development one configuration
  # source without copying model, MCP, or internal-auth values between services.
  env_args=(--env-file "$repo_root/web/.env.local")
fi

cd "$repo_root/langgraph-agent"
exec uv run uvicorn gol_agent.app:app \
  --host 127.0.0.1 \
  --port 8124 \
  --reload \
  "${env_args[@]}"
