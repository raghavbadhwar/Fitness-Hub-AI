# Repository Hygiene

Fitness Hub AI keeps source code, docs, tests, migrations, and required generated API clients in
git. Machine-local runtime state and visual QA evidence should stay untracked.

## Ignored Local Artifacts

The root `.gitignore` covers the known local/runtime paths:

- `.local/`
- `.codex/`
- `.playwright-cli/`
- `.vercel`
- `dist`
- `test-results/`
- `*.log`
- root-level `fitness-*.png` visual QA screenshots
- duplicate local repo snapshots such as `/Fitness-Hub-AI` and `/Fitness-Hub-AI.zip`

## Before Committing

Run these checks when cleanup touches repo structure or generated outputs:

```bash
git ls-files | grep -E '(^\.local/|^\.playwright-cli/|^\.codex/|^\.vercel/)' || true
pnpm run format:check
git diff --check
```

Do not remove source assets such as `artifacts/gymapp/assets/images/icon.png`; tracked app assets
are product files, not local evidence.
