# Fitness Hub AI — Copilot Instructions

## Canonical workspace layout

- `artifacts/api-server`: Express 5 API (`/api/*`) + Clerk auth + Drizzle/Postgres access.
- `artifacts/admin`: owner-only React + Vite admin app, served under `/admin/`.
- `artifacts/gymapp`: Expo (React Native + web) member app.
- `lib/db`: shared Drizzle schema + DB client.
- `lib/api-spec`: OpenAPI source (`openapi.yaml`) + Orval config.
- `lib/api-client-react` and `lib/api-zod`: generated API client/hooks and generated Zod contracts.

Prefer these canonical app roots (ignore retired/snapshot variants referenced elsewhere).

## Build, test, lint, and codegen commands

Use **pnpm** only (root preinstall enforces this).

- Full workspace typecheck: `pnpm run typecheck`
- Full workspace build (typecheck + package builds): `pnpm run build`
- Vercel-style guarded build: `pnpm run build:vercel`
- Format: `pnpm run format`
- Lint-equivalent formatting check: `pnpm run format:check`
- API dev server: `pnpm run dev:api`
- Admin dev server: `pnpm run dev:admin`
- Member dev server (Expo native): `pnpm run dev:member`
- Member web dev server (Expo web): `pnpm run dev:member:web`
- OpenAPI codegen: `pnpm --dir lib/api-spec codegen`

There is no root `test` script; use package-scoped and Playwright test entrypoints below.

### Test entrypoints

- API route tests (all): `pnpm --dir artifacts/api-server test`
- API single test file: `pnpm --dir artifacts/api-server test -- tests/routes/ai.test.mjs`
- API single lib test file: `pnpm --dir artifacts/api-server test -- tests/lib/http-security.test.mjs`
- Gym app node tests (configured suite): `pnpm --dir artifacts/gymapp test`
- Gym app single test file: `pnpm --dir artifacts/gymapp exec node --experimental-test-module-mocks --experimental-strip-types --test lib/api-base.test.ts`
- Gym app single monthly review test file: `pnpm --dir artifacts/gymapp exec node --experimental-test-module-mocks --experimental-strip-types --test lib/monthly-review.test.ts`
- Scripts package tests: `pnpm --dir scripts test`
- Admin/API smoke E2E: `pnpm run test:e2e:smoke`
- UI preview E2E: `pnpm run test:e2e:ui`
- Single Playwright spec: `pnpm exec playwright test tests/e2e/member-flows.spec.ts`
- Full beta verification gate: `pnpm run verify:internal-beta`

### Package-scoped essentials

- API only typecheck: `pnpm --filter @workspace/api-server run typecheck`
- Admin only typecheck: `pnpm --filter @workspace/admin run typecheck`
- Gym app only typecheck: `pnpm --filter @workspace/gymapp run typecheck`
- Regenerate API client + Zod from OpenAPI: `pnpm --dir lib/api-spec codegen`
- Push DB schema (Drizzle): `pnpm --filter @workspace/db run push`

## High-level architecture (cross-package flow)

1. `artifacts/gymapp` and `artifacts/admin` both authenticate with Clerk, but authorization is server-resolved:
   - member/trainer app access is checked through `/api/profiles/access-check` and `/api/profiles/sync`
   - admin owner access is checked through `/api/admin/access`
2. API routes are mounted under `/api` and split by concern: `/admin`, `/profiles`, `/workouts`, `/classes`, `/monthly-reviews`, `/ai`.
3. API authorization is approval-aware, not only auth-aware: route handlers commonly use `requireApprovedAccess` from `src/lib/user-access.ts`.
4. AI routes enforce middleware in this order: `requireAuth()` -> fixed-window rate limiting -> approved-access check.
5. AI features are only exposed through `/api/ai/*`; Gemini credentials are loaded in `@workspace/integrations-gemini-ai` and stay server-side.
6. OpenAPI-driven development is mandatory: `lib/api-spec/openapi.yaml` is the source; Orval generates:
   - `lib/api-client-react/src/generated/*` (React Query client)
   - `lib/api-zod/src/generated/*` (Zod schemas)
7. Admin UI uses generated hooks from `@workspace/api-client-react` and configures auth-aware requests via `setBaseUrl` + `setAuthTokenGetter`; gym app is local-first (AsyncStorage) with selective API sync.

## Project-specific conventions

- **Access model is approval-aware, not just authenticated**:
  - `member`/`trainer` users can be `pending` or `revoked` via `user_access_controls`.
  - Gym app routes blocked users to `/approval-required` based on `/api/profiles/access-check` and `/api/profiles/sync`.
- **Admin access has two server-side modes**:
  - If `ADMIN_GYM_OWNER_EMAILS` or `ADMIN_ALLOWED_EMAILS` is configured, email allowlists drive owner access.
  - Without allowlists, Clerk `publicMetadata.role === "owner"` is required.
- **Mobile is local-first and user-scoped**:
  - Contexts persist to AsyncStorage (`@gymapp_*` keys).
  - Several stores are user-scoped with `:<userId>` suffixes.
  - Schedule/workout flows perform server sync when possible, but retain local fallback data paths.
- **Class roster updates are concurrency-protected**:
  - `classes` route enrollment/waitlist writes use SQL transactions with `FOR UPDATE` locking to avoid oversubscription races.
- **Generated artifacts are never hand-edited**:
  - Update `lib/api-spec/openapi.yaml` then run codegen.
- **OpenAPI title is a compatibility constraint**:
  - Keep `openapi.info.title` as `"Api"` (Orval output/import paths depend on it).
- **Environment handling is fail-fast in backend/shared libs**:
  - Missing `CLERK_SECRET_KEY`, `PORT`, `DATABASE_URL`, or Gemini integration env vars throw at startup.
- **CORS config is centralized and env-driven**:
  - Backend CORS origins are derived from `CORS_ALLOWED_ORIGINS` plus app base URL env vars in `src/lib/http-security.ts`.
  - Loopback origins are auto-allowed only in non-production.
- **Supply-chain hardening is enforced in pnpm workspace config**:
  - `minimumReleaseAge: 1440` blocks brand-new npm versions by default.
- **Reuse shared packages through workspace imports**:
  - Prefer `@workspace/*` over duplicating contracts/types/fetch code in app packages.

## Environment and runtime expectations

- Root dev scripts source `.env.local` before launching apps.
- Commonly required vars across the workspace include:
  - `DATABASE_URL`
  - `CLERK_SECRET_KEY`, publishable key vars for clients
  - `AI_INTEGRATIONS_GEMINI_API_KEY`, `AI_INTEGRATIONS_GEMINI_BASE_URL`
  - `PORT`, `BASE_PATH` (notably for admin/app serving paths)

## Additional repo instruction sources incorporated

- `README.md`: canonical surfaces, command set, and OpenAPI/codegen ownership.
- `CONTRIBUTING.md`: verification flow and generated-file boundaries.
- `AGENTS.md`: canonical repo root, deployment guardrails, and security-sensitive surfaces.
