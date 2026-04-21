#!/usr/bin/env bash
set -euo pipefail

CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
PWCLI_PATH="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"

npx_available=false
linkedin_cli_available=false
playwright_wrapper_available=false
preferred_mode="manual-setup-required"

npx_path=""
linkedin_cli_path=""

if command -v npx >/dev/null 2>&1; then
  npx_available=true
  npx_path="$(command -v npx)"
fi

if command -v linkedin >/dev/null 2>&1; then
  linkedin_cli_available=true
  linkedin_cli_path="$(command -v linkedin)"
fi

if [ -f "$PWCLI_PATH" ]; then
  playwright_wrapper_available=true
fi

if [ "$linkedin_cli_available" = true ]; then
  preferred_mode="linkedin-cli"
elif [ "$npx_available" = true ] && [ "$playwright_wrapper_available" = true ]; then
  preferred_mode="playwright"
fi

cat <<EOF
{
  "preferredMode": "$preferred_mode",
  "npx": {
    "available": $npx_available,
    "path": "$npx_path"
  },
  "linkedinCli": {
    "available": $linkedin_cli_available,
    "path": "$linkedin_cli_path"
  },
  "playwrightWrapper": {
    "available": $playwright_wrapper_available,
    "path": "$PWCLI_PATH"
  }
}
EOF
