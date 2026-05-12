# QA Evidence

This file records verification evidence for the Cal AI and Hevy level logging upgrade.

## Baseline

Passed on 2026-05-10:

- `pnpm run typecheck`: passed.
- `pnpm --dir artifacts/api-server test -- tests/routes/nutrition.test.mjs tests/routes/workouts.test.mjs tests/routes/ai.test.mjs tests/routes/ai-quality.test.mjs`: 34 passed.
- `pnpm --dir artifacts/gymapp test`: 41 passed before implementation.
- `CI=1 pnpm exec playwright test tests/e2e/ui-preview.spec.ts`: 12 passed.

Notes:

- KARIMO upstream installer copied `.karimo` and `.claude/plugins/karimo` assets but exited on missing `.github/ISSUE_TEMPLATE/karimo-task.yml`. This is recorded as a non-blocking setup defect because the repo-local assets and config exist.
- Local shell emits a Node engine warning: repo wants Node `22.x`, current shell is Node `v24.12.0`.

## T07 Previous-Set Autofill

Passed on 2026-05-10:

- `pnpm --dir artifacts/gymapp test`: 43 passed after adding `workout-history` coverage.
- `pnpm --dir artifacts/gymapp typecheck`: passed.
- `pnpm run typecheck`: passed.
- `CI=1 pnpm exec playwright test tests/e2e/ui-preview.spec.ts -g "member (home preview routes first workout|workout preview scrolls)"`: 2 passed.

## Final Gate

Passed on 2026-05-10:

- `pnpm --dir lib/api-spec codegen`: passed, regenerated React Query and Zod clients.
- `pnpm --dir artifacts/gymapp test`: 45 passed.
- `pnpm --dir artifacts/api-server test -- tests/routes/nutrition.test.mjs tests/routes/workouts.test.mjs tests/routes/ai.test.mjs tests/routes/ai-quality.test.mjs`: 34 passed.
- `pnpm run typecheck`: passed under the default shell, with the known Node 24 engine warning.
- `pnpm run test:e2e:smoke`: 2 passed.
- `pnpm run test:e2e:ui`: 12 passed.
- `mise x node@22.22.2 -- pnpm run verify:internal-beta`: passed. The gate included Node and secret preflights, codegen, 72 API route tests, full build, and 19 Playwright checks.

Implemented coverage:

- Nutrition logs preserve source, confidence, ingredients, correction, barcode, and relog metadata through API and DB JSON types.
- Food photo analysis can be corrected before saving instead of accepting AI output as final.
- Nutrition search exposes one-tap recent-food relogging.
- Workout sessions preserve set type, RPE, RIR, notes, previous values, and progression hints through local state, API parsing, DB JSON types, OpenAPI, and generated clients.
- Saved-plan starts hydrate sets from prior completed sessions.

## India-Aware AI Logging Foundation Gate

Passed on 2026-05-10:

- `node -e "JSON.parse(...india-aware-ai-logging-contract.json)"`: passed.
- `pnpm exec prettier --check .karimo/prds/calai-hevy-logging-upgrade/india-aware-ai-logging-contract.json`: passed.
- `pnpm --dir lib/api-spec codegen`: passed, regenerated React Query and Zod clients.
- `pnpm --dir artifacts/api-server test -- tests/routes/foods.test.mjs tests/routes/nutrition.test.mjs tests/routes/workouts.test.mjs tests/routes/ai.test.mjs tests/routes/ai-quality.test.mjs`: 39 passed.
- `pnpm run typecheck`: passed under the default shell, with the known Node 24 engine warning.
- `pnpm --dir artifacts/gymapp test`: 45 passed.
- `pnpm exec prettier --check` on authored JSON/TS/JS/YAML files: passed. SQL migration was excluded because the repo has no SQL Prettier parser.
- `rg -n "DROP |TRUNCATE |DELETE FROM [^;]+;|ALTER TABLE .* DROP" lib/db/migrations/0012_india_aware_logging_foundations.sql`: no destructive migration pattern found.
- `git diff --check && git diff --cached --check`: passed.
- `mise exec node@22 -- pnpm run verify:internal-beta`: passed. The gate included Node and secret preflights, codegen, 72 API route tests, full build, and 19 Playwright checks.

Implemented coverage:

- Added the execution contract at `india-aware-ai-logging-contract.json` for scripts, pass/fail criteria, database structures, fallbacks, provider strategy, and AI data maturity.
- Added Drizzle schema and migration foundations for food catalog items, member custom foods, lookup events, exercise catalog items, custom exercises, normalized workout set history, metric-specific exercise PRs, prompt versions, and AI inference events.
- Added server-side `/api/foods/*` routes for search, barcode lookup, custom food saving, Open Food Facts fallback, optional USDA search, lookup telemetry, and India-aware curated portion fallback.
- Added workout exercise APIs for system/custom exercise search, custom exercise creation, exercise history, and bounded workout analytics.
- Workout session create/update now transactionally rebuilds normalized completed-set history and metric-specific PR data while preserving existing personal-record behavior.
- OpenAPI source and generated React/Zod clients now include the food and workout-history foundation APIs.

## End-To-End Member UX And Real User Test Gate

Passed on 2026-05-10:

- Red phase: `pnpm --dir artifacts/gymapp test` failed on missing `food-logging-api.ts` and missing `hydrateSessionExercisesFromHistory` export.
- Green phase: `pnpm --dir artifacts/gymapp test`: 51 passed.
- `node -e "JSON.parse(...)"` for `tasks.json`, `status.json`, and `india-aware-ai-logging-contract.json`: passed.
- `pnpm exec prettier --check` on PRD, research notes, real-user test plan, changed gymapp TS/TSX, and E2E spec: passed.
- `pnpm run typecheck`: passed under the default shell, with the known Node 24 engine warning.
- `pnpm --dir artifacts/api-server test -- tests/routes/foods.test.mjs tests/routes/nutrition.test.mjs tests/routes/workouts.test.mjs tests/routes/ai.test.mjs tests/routes/ai-quality.test.mjs`: 39 passed.
- `CI=1 pnpm exec playwright test tests/e2e/member-flows.spec.ts -g "nutrition preview"`: 1 passed.
- `mise exec node@22 -- pnpm --dir artifacts/api-server test -- tests/routes/ai.test.mjs`: 14 passed after pinning the test rate-limit store to memory.
- `mise exec node@22 -- pnpm run verify:internal-beta`: passed. The gate included Node and secret preflights, OpenAPI codegen, 72 API route tests, full build/typecheck, and 20 Playwright checks. One admin sign-in browser check timed out on the first attempt and passed on retry, so Playwright reported it as flaky but the command exited successfully.
- `git diff --check && git diff --cached --check`: passed before final status documentation updates.

Implemented coverage:

- Added `research-notes.md` with product/data grounding for Cal AI-style and Hevy-style logging decisions.
- Added `real-user-test-plan.md` covering Indian mixed-diet food search, barcode/label fallback, AI photo correction, and repeated workout logging.
- Added `food-logging-api.ts` with search/barcode/custom-food helpers that preserve provider, confidence, serving, barcode, and fallback metadata.
- Member Nutrition search now prefers `/api/foods/search`, falls back to the local curated catalogue, and displays user-readable provider/confidence labels.
- Add Meal barcode mode now looks up `/api/foods/barcode/:barcode`, fills an editable draft on provider match, and routes misses/errors to label/manual entry.
- Manual, corrected AI-photo, and barcode/label foods save custom-food drafts best-effort while preserving normal local-first logging.
- Workout history hydration now runs through the shared `startSession` path and the add-exercise path, so saved plans, quick starts, assigned workouts, AI starts, and manual additions share previous-set behavior.
- Active workout exercise cards now show last performed date, last top set, and best estimated 1RM when history exists.
- AI rate-limit route tests now pin the test rate-limit configuration, avoiding ambient environment drift during the release gate.
