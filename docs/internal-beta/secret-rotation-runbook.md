# Internal Beta Secret Incident Runbook

This repo now treats the previously tracked `.env.local` incident as a release gate for internal beta work.

## What Changed

- `.env.local` is ignored and must stay untracked.
- `.env.example` is the only committed env template and must remain sanitized.
- `pnpm run preflight:beta-secrets` now checks:
  - `.env.local` is not tracked
  - the committed env template still uses placeholders
  - the historic tracked-env incident has been resolved locally either by provider-side rotation or by an explicit accepted-risk acknowledgment

## Secrets That Must Be Rotated

- `CLERK_SECRET_KEY`
- `DATABASE_URL`
- `DATABASE_ADMIN_URL`
- `DATABASE_APP_PASSWORD`
- `AI_INTEGRATIONS_GEMINI_API_KEY`

These are the values that represent real secret risk in the current workspace. Public keys and local helper values stay in the env template but are not part of the incident attestation.

## Operator Workflow: Rotate

1. Initialize the local attestation file:
   - `pnpm run preflight:beta-secrets:init`
2. Rotate each provider secret in its source system:
   - Clerk dashboard for `CLERK_SECRET_KEY`
   - Supabase / Postgres credentials for the database URLs and app password
   - Gemini provider console for `AI_INTEGRATIONS_GEMINI_API_KEY`
3. Update your local `.env.local` with the new values.
4. Edit `.local/state/secret-rotation-status.json`:
   - set `rotatedAt` to the completion timestamp
   - flip every secret flag to `true`
   - keep notes brief and non-sensitive
5. Run the secret gate:
   - `pnpm run preflight:beta-secrets`
6. Run the full internal beta verification command:
   - `pnpm run verify:internal-beta`

## Operator Workflow: Accepted Risk

Use this only when you are intentionally proceeding with the known residual risk for internal beta on your local machine.

1. Record the local-only accepted-risk decision:
   - `pnpm run preflight:beta-secrets:accept-risk`
2. Review `.local/state/secret-rotation-status.json`:
   - confirm `resolution` is `accepted-risk`
   - confirm `acceptedAt` and `acceptedBy` were written
   - keep notes brief and non-sensitive
3. Run the secret gate:
   - `pnpm run preflight:beta-secrets`
4. Run the full internal beta verification command:
   - `pnpm run verify:internal-beta`

## Notes

- The attestation file lives under `.local/state/` so it stays machine-local and never needs secret values.
- `pnpm run verify:internal-beta` intentionally starts with the secret preflight. If the incident is not marked resolved one way or the other, the repo should stop before the normal build-and-browser loop.
- `pnpm run preflight:beta-secrets:accept-risk` records a decision. It does not rotate or invalidate provider-side secrets.
- Provider-side rotation remains the safer path for anything beyond this scoped internal beta.
