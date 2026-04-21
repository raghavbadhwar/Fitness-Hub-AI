# Fitness Hub AI — Copilot Instructions

## Canonical workspace layout

- `artifacts/api-server`: Express 5 API (`/api/*`) + Clerk auth + Drizzle/Postgres access.
- `artifacts/admin`: owner-only React + Vite admin app, served under `/admin/`.
- `artifacts/gymapp`: Expo (React Native + web) member app.
- `lib/db`: shared Drizzle schema + DB client.
- `lib/api-spec`: OpenAPI source (`openapi.yaml`) + Orval config.
- `lib/api-client-react` and `lib/api-zod`: generated API client/hooks and generated Zod contracts.

Prefer these canonical app roots (ignore retired/snapshot variants referenced elsewhere).

## Build, typecheck, dev, and codegen commands

Use **pnpm** only (root preinstall enforces this).

- Full typecheck (workspace references): `pnpm run typecheck`
- Full build (typecheck + all package builds): `pnpm run build`
- Format the repo: `pnpm run format`
- Check formatting only: `pnpm run format:check`
- API dev: `pnpm run dev:api`
- Admin dev: `pnpm run dev:admin`
- Member/mobile dev (Expo): `pnpm run dev:member`

Package-scoped commands:

- API only typecheck: `pnpm --filter @workspace/api-server run typecheck`
- Admin only typecheck: `pnpm --filter @workspace/admin run typecheck`
- Gym app only typecheck: `pnpm --filter @workspace/gymapp run typecheck`
- Regenerate API client + Zod types from OpenAPI: `pnpm --filter @workspace/api-spec run codegen`
- Push DB schema (Drizzle): `pnpm --filter @workspace/db run push`

Testing/linting:

- Root test entrypoints are focused on smoke and beta verification flows rather than one generic `test` script.
- No ESLint/biome config is currently present; formatting is handled with Prettier via the root scripts.

## High-level architecture (cross-package flow)

1. `artifacts/gymapp` and `artifacts/admin` authenticate with Clerk.
2. Both clients call `artifacts/api-server` endpoints under `/api`.
3. API routes use `@workspace/db` (Drizzle + Postgres) for persistence and `@workspace/api-zod` contracts for validation/typing.
4. AI features route through `@workspace/integrations-gemini-ai` (Gemini client wrapper) and are exposed via `/api/ai/*`.
5. OpenAPI-driven development: `lib/api-spec/openapi.yaml` is the source; Orval generates:
   - `lib/api-client-react/src/generated/*` (React Query client)
   - `lib/api-zod/src/generated/*` (Zod schemas)

## Project-specific conventions

- **Role model is Clerk + DB synced**: app role decisions depend on both Clerk `publicMetadata.role` and `user_profiles` sync (`/api/profiles/sync`), not just client state.
- **Admin access is strict owner-only**: admin UI gate (`user.publicMetadata.role === "owner"`) and server-side owner checks in `/api/admin/*`.
- **Mobile is local-first but server-synced**:
  - Contexts persist to AsyncStorage (`@gymapp_*` keys).
  - Several stores are user-scoped with `:<userId>` suffixes.
  - Schedule/workout/chat attempt API sync, with local fallback behavior in some flows.
- **Generated API artifacts are not hand-edited**:
  - Edit `lib/api-spec/openapi.yaml` (and related config) first, then run codegen.
- **Environment handling is fail-fast in backend/shared libs**:
  - Missing required env vars (for example `PORT`, `DATABASE_URL`, Gemini keys/base URL) throw early.
- **Workspace imports**:
  - Reuse shared packages via `@workspace/*` imports instead of duplicating contracts/types per app.

## Environment and runtime expectations

- Root dev scripts source `.env.local` before launching apps.
- Commonly required vars across the workspace include:
  - `DATABASE_URL`
  - `CLERK_SECRET_KEY`, publishable key vars for clients
  - `AI_INTEGRATIONS_GEMINI_API_KEY`, `AI_INTEGRATIONS_GEMINI_BASE_URL`
  - `PORT`, `BASE_PATH` (notably for admin/app serving paths)
