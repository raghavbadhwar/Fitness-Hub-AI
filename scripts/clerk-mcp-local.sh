#!/bin/sh
set -eu

REPO_ROOT="/Volumes/RAGHAV2/Projects/Fitness-Hub-AI"
ENV_FILE="$REPO_ROOT/.env.local"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE" >&2
  exit 1
fi

set -a
. "$ENV_FILE"
set +a

if [ -z "${CLERK_SECRET_KEY:-}" ]; then
  echo "CLERK_SECRET_KEY is not set in $ENV_FILE" >&2
  exit 1
fi

exec npx -y @clerk/agent-toolkit --tools '*' --secret-key "$CLERK_SECRET_KEY"
