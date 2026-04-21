# LinkedIn Operator

Repo-local Codex plugin for controlling a real LinkedIn session with browser automation, structured extraction, and confirmation-gated outbound actions.

## What it does

- checks whether a LinkedIn session is logged in
- searches people and companies
- extracts structured profile data from visible pages
- reviews the LinkedIn inbox and drafts replies
- prepares messages, connection requests, comments, and posts
- requires explicit confirmation before any outbound action is sent

## Files

- `.codex-plugin/plugin.json`: plugin manifest
- `skills/SKILL.md`: operating instructions Codex follows when the plugin is used
- `scripts/check_runtime.sh`: checks whether Playwright or the optional `linkedin` CLI runtime is available

## Runtime model

This first version is intentionally skill-first. It uses browser automation already available in Codex instead of bundling a separate MCP server that would add new package dependencies.

Use the runtime checker:

```bash
plugins/linkedin-operator/scripts/check_runtime.sh
```

Preferred mode order:

1. Playwright/browser automation
2. Optional `linkedin` CLI if you install and authenticate it
