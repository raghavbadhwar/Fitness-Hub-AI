---
name: linkedin-operator
description: Use this plugin to control a real LinkedIn session for research, inbox review, drafting outreach, and confirmation-gated outbound actions.
---

# LinkedIn Operator

Use this plugin when the task requires:

- opening or verifying a logged-in LinkedIn session
- searching people or companies on LinkedIn
- extracting structured profile or company data from visible pages
- reviewing the LinkedIn inbox and drafting replies
- preparing connection requests, messages, comments, or posts
- performing a single outbound LinkedIn action after explicit confirmation

## Preferred runtime order

1. Preferred: use Playwright-based browser automation because it is already available in Codex and does not require an extra LinkedIn SDK.
2. Optional: if the `linkedin` CLI is installed and authenticated, use it for structured fetch or send actions.
3. If neither runtime is ready, run `plugins/linkedin-operator/scripts/check_runtime.sh` and report the missing pieces before proceeding.

## Recommended flow

1. Run the runtime check when session state or dependencies are unclear.
2. Open `https://www.linkedin.com/feed/` in a headed browser and verify login state before any stateful action.
3. For research tasks, navigate search or profile pages first, then return structured JSON with only the fields the user asked for.
4. For inbox tasks, summarize or draft first. Do not send automatically.
5. For outbound actions, show the exact target and exact payload, get explicit confirmation in the current turn, then perform only that single action.
6. After any state-changing action, capture the resulting UI state so the user can verify what happened.

## Action policy

These actions require explicit confirmation in the current turn:

- sending a message
- sending a connection request
- reacting to content
- posting a comment
- publishing a post
- withdrawing or deleting content

Safe-without-confirmation actions:

- opening LinkedIn
- checking login status
- browsing search results
- opening profiles or company pages
- extracting visible data
- drafting content without submitting it

## Output contract

When returning structured LinkedIn results, prefer compact JSON arrays or tables with stable fields such as:

- `name`
- `title`
- `company`
- `location`
- `profileUrl`
- `mutualConnections`
- `notes`

If any field is not visible or reliable, omit it instead of guessing.

## Safety rules

- Never assume a saved LinkedIn session is still valid. Verify login first.
- Never send multiple outbound actions in one batch unless the user explicitly asks for a batch and confirms the exact list.
- Never invent profile facts, inbox content, or company details. Extract only what is visible.
- Stop and surface the blocker if LinkedIn shows a checkpoint, CAPTCHA, rate-limit warning, or suspicious-login challenge.
- Respect LinkedIn terms, user privacy, and account health. Prefer slower, human-like navigation over aggressive automation.

## Runtime notes

- Playwright wrapper path: `~/.codex/skills/playwright/scripts/playwright_cli.sh`
- Optional CLI path: `linkedin`
- Runtime verifier: `plugins/linkedin-operator/scripts/check_runtime.sh`
