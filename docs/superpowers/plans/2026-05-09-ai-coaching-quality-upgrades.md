# AI Coaching Quality Upgrades

## Goal

Find AI coaching features that are mechanically working but below a sellable quality bar, then upgrade them one by one with deterministic validation, stronger personalization, and focused tests.

## Feature Ratings From Inspection

- AI workout generator: 7/10. It is authenticated, rate-limited, and calls Gemini, but the frontend hardcodes experience/time, omits direct profile constraints such as equipment and injuries, and the server trusts model JSON without schema or safety validation.
- AI food analyzer: 7/10. It is authenticated, payload-size-limited, and calls Gemini, but the server returns parsed model JSON without validating required fields, numeric bounds, confidence values, or ingredient shape.
- AI chat coach: above this pass threshold for now. It already has message limits, safety concern short-circuiting, durable memory, and streaming behavior tests.
- Monthly review AI: above this pass threshold for now. It has bounded aggregate inputs and deterministic fallback behavior.

## Files To Modify

- `artifacts/api-server/src/routes/ai.ts`
  - Add normalized AI response validators for food analysis and workout suggestions.
  - Strengthen workout prompt inputs with profile constraints.
  - Reject malformed, unsafe, empty, or incompatible model outputs before returning them.
- `artifacts/api-server/tests/routes/ai.test.mjs`
  - Add tests for malformed food/workout model output.
  - Add tests proving workout prompt personalization includes experience, equipment, injuries, available time, saved plans, behavior profile, and durable memory.
  - Add tests proving injury-sensitive workout output is rejected.
- `artifacts/gymapp/app/(tabs)/workout.tsx`
  - Send the actual member profile constraints instead of hardcoded `intermediate` and incomplete context.
  - Add explicit requested time, equipment, injuries, workout time, activity level, and profile summary fields.
- `docs/superpowers/plans/2026-05-09-ai-coaching-quality-upgrades.md`
  - This plan and execution log.

## Bite-Sized Tasks

1. Harden AI workout generator inputs and backend output validation.
   - Verify: `mise exec node@22 -- pnpm --dir artifacts/api-server test -- tests/routes/ai.test.mjs`
   - Verify: `mise exec node@22 -- pnpm --dir artifacts/gymapp typecheck`

2. Harden AI food analyzer output validation.
   - Verify: `mise exec node@22 -- pnpm --dir artifacts/api-server test -- tests/routes/ai.test.mjs`

3. Run full closeout gates and inspect the diff.
   - Verify: `mise exec node@22 -- pnpm -r --if-present run test`
   - Verify: `mise exec node@22 -- pnpm run lint`
   - Verify: `mise exec node@22 -- pnpm run typecheck`
   - Verify: `mise exec node@22 -- pnpm run build`
   - Verify: `git diff --check`
   - Verify: `git status --short`

## Success Criteria

- Workout suggestions are personalized from actual member constraints and durable memory.
- Workout suggestions with empty exercise lists, malformed exercises, unsafe pain-sensitive exercises, or incompatible injury context are rejected with 502.
- Food analysis responses with missing required fields, invalid confidence, invalid ingredients, or unrealistic nutrition numbers are rejected with 502.
- Existing auth, access control, and rate-limit tests continue passing.
- Full test, lint, typecheck, and build gates pass before closeout.

## Execution Log

- Task 1 completed: workout generation now sends real member training constraints from the member app and validates model output on the API before returning it.
- Task 1 verification passed: `mise exec node@22 -- pnpm --dir artifacts/api-server test -- tests/routes/ai.test.mjs` -> 14/14 passed.
- Task 1 verification passed: `mise exec node@22 -- pnpm --dir artifacts/gymapp typecheck` -> exit 0.
- Task 2 completed: food analysis now validates required fields, confidence, ingredients, and conservative nutrition bounds before returning model output.
- Task 2 verification passed: `mise exec node@22 -- pnpm --dir artifacts/api-server test -- tests/routes/ai.test.mjs` -> 14/14 passed.
