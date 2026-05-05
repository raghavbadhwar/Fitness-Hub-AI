# Codex Task Board

This file keeps Codex work grounded in the real Fitness Hub AI repo. It is not a product roadmap by itself; it is the standing operating checklist for implementation, hardening, verification, and launch-readiness work.

## Canonical Surfaces

| Surface         | Path                         | Primary risk                                                    |
| --------------- | ---------------------------- | --------------------------------------------------------------- |
| Admin web app   | `artifacts/admin`            | Owner-only access, access grants, API wiring, dashboard UX      |
| Member app      | `artifacts/gymapp`           | Auth state, access state, mobile/web parity, local-first flows  |
| API server      | `artifacts/api-server`       | Clerk auth, route authorization, database writes, AI boundaries |
| API contract    | `lib/api-spec/openapi.yaml`  | Generated clients and schemas drifting from server behavior     |
| Database        | `lib/db`                     | Schema parity, migrations, role/access data consistency         |
| AI integration  | `lib/integrations-gemini-ai` | Secret handling, degraded behavior when Gemini is unavailable   |
| Release scripts | `scripts`                    | Internal beta preflight, production env guardrails              |

## Default Codex Intake

Before editing:

1. Confirm the repo root is `/Volumes/RAGHAV2/Projects/Fitness-Hub-AI`.
2. Identify which surface owns the behavior.
3. Check whether the task touches auth, API contracts, generated clients, database schema, deployment, or public UI.
4. Pick the narrowest verification command that proves the change.

During implementation:

1. Keep generated files generated.
2. Keep secrets out of committed files and frontend bundles.
3. Preserve owner-only admin access and member access gating.
4. Add or update tests when behavior changes across a route, auth state, generated contract, or user-facing flow.

Before closeout:

1. Run the relevant verification.
2. State any skipped verification and the exact blocker.
3. Report changed files and remaining risks briefly.

## Verification Matrix

| Change type                                                      | Minimum verification                                                                           |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Docs only                                                        | `pnpm exec prettier --check <changed docs>`                                                    |
| Root config/scripts                                              | `pnpm exec prettier --check <changed files>` plus the relevant script dry run or targeted test |
| Shared TypeScript types                                          | `pnpm run typecheck`                                                                           |
| OpenAPI contract                                                 | `pnpm --dir lib/api-spec codegen` and `pnpm run typecheck`                                     |
| API route behavior                                               | `pnpm --dir artifacts/api-server test -- <relevant route tests>`                               |
| Admin auth/access UI                                             | API route test plus `pnpm run test:e2e:smoke` when services are available                      |
| Member auth/access UI                                            | member package tests plus `pnpm run test:e2e:ui` when services are available                   |
| Cross-surface auth, routing, generated client, or deploy changes | `pnpm run verify:internal-beta`                                                                |
| Vercel production build behavior                                 | `pnpm run build:vercel` with production-like envs                                              |

## Standing QA Matrix

Use this matrix whenever a task touches auth, access control, routing, onboarding, member status, dashboard data, or AI-powered flows.

| Scenario                                      | Expected result                                                          | Suggested proof                                            |
| --------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Signed-out visitor opens `/admin/`            | User is asked to sign in or denied without admin data leakage            | Browser check or admin E2E                                 |
| Signed-out visitor opens member web app       | Public/auth entry state renders cleanly                                  | Browser check or UI E2E                                    |
| Owner opens admin app                         | Admin dashboard loads and owner-only actions remain available            | Browser check plus API smoke                               |
| Non-owner opens admin app                     | Admin data and owner actions are blocked                                 | API route test plus browser check when possible            |
| Authorized member opens member app            | Member home, profile, workouts/classes, and allowed data render          | Member test or UI E2E                                      |
| Revoked or unapproved member opens member app | Access-blocked state renders without privileged data                     | Member test or UI E2E                                      |
| API health check                              | `/api/healthz` returns healthy status                                    | API smoke                                                  |
| Gemini unavailable or invalid response        | UI/API returns a clear degraded/error state without leaking secrets      | API route test or manual API check                         |
| Monthly review generated or reviewed          | Saved aggregate review respects member/trainer access and AI fallback    | Monthly review route test plus member aggregation test     |
| Database schema changed                       | Local schema, generated clients, and route behavior agree                | DB push/migration check plus typecheck/tests               |
| Deploy-prep run                               | Secret preflight and production Clerk key guardrails stop unsafe deploys | `pnpm run verify:internal-beta` or `pnpm run build:vercel` |

## Launch-Readiness Gates

For internal beta:

1. `.env.local` is untracked and sanitized values remain in `.env.example`.
2. `pnpm run preflight:beta-secrets` passes through rotation or accepted-risk attestation.
3. `pnpm run verify:internal-beta` passes.
4. Admin, member, API, auth, and AI degraded states have been checked for the changed surface.

For production:

1. Vercel has live Clerk keys from the same production Clerk instance.
2. `ADMIN_ALLOWED_EMAILS`, database URLs, and Gemini configuration are provider-managed env vars.
3. Clerk production domains and `/api/__clerk` proxy settings match `docs/deployment.md`.
4. `pnpm run build:vercel` passes with production-like envs.
5. Real browser checks confirm signed-out, owner, member, and blocked-member states.

## External Blockers To Report Clearly

- Missing Clerk, database, Gemini, Vercel, Apple, Google, or Expo credentials.
- Provider-side secret rotation not completed.
- Database unavailable or schema not applied.
- Browser session unavailable for UI proof.
- Device/emulator tooling unavailable for native mobile proof.
- Production deployment blocked by provider config rather than repo code.

When one of these blocks verification, stop at the highest repo-side proof available and name the external blocker directly.
