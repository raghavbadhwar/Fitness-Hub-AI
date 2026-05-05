# Fitness Hub AI Codex Instructions

You are working in the canonical Fitness Hub AI repository:

`/Volumes/RAGHAV2/Projects/Fitness-Hub-AI`

Do not create a parallel app root or work from a nested duplicate checkout. Confirm the repo root with `pnpm-workspace.yaml` when there is any doubt.

## Product Shape

Fitness Hub AI is a pnpm monorepo for an AI-assisted gym product with three runtime surfaces:

- `artifacts/admin`: owner-facing React + Vite admin app served under `/admin/`
- `artifacts/gymapp`: Expo member app for iOS, Android, and web
- `artifacts/api-server`: Express API mounted under `/api/*`

Shared workspace packages:

- `lib/api-spec`: OpenAPI source of truth and code generation
- `lib/api-client-react`: generated React Query client
- `lib/api-zod`: generated Zod schemas
- `lib/db`: Drizzle schema, migrations, and database utilities
- `lib/integrations-gemini-ai`: Gemini integration helpers
- `scripts`: operational checks and release gates
- `plugins`: repo-local Codex plugins, optional for app runtime

## Default Engineering Loop

For any fix, feature, hardening task, or deploy-prep task:

1. Inspect the relevant app/package before editing.
2. Keep changes scoped to the requested surface.
3. Preserve existing behavior unless the task requires changing it.
4. Run the smallest verification that proves the change.
5. Broaden to build, E2E, or release gates when auth, routing, generated clients, deployment, or shared contracts are touched.
6. Report what changed, what passed, and what remains.

## Source-of-Truth Rules

- Use `pnpm` only. The root preinstall script rejects npm and yarn.
- Treat `lib/api-spec/openapi.yaml` as the API contract source of truth.
- Do not hand-edit generated files in:
  - `lib/api-client-react/src/generated`
  - `lib/api-zod/src/generated`
- After OpenAPI changes, regenerate clients and schemas with `pnpm --dir lib/api-spec codegen`.
- Reuse shared packages through `@workspace/*` imports instead of duplicating contracts or helpers.
- Keep repo-local plugin code separate from app runtime behavior unless a task explicitly connects them.

## Auth, Secrets, and AI Boundaries

- Keep real credentials in `.env.local` for local work and provider-managed environment variables for deployments.
- Never commit API keys, database passwords, Clerk secrets, bearer tokens, or machine-local state.
- Frontend code may only receive intentionally public values such as Clerk publishable keys and public base URLs.
- Keep Clerk owner/admin access enforced on both the client and server.
- Treat `/api/admin/*`, `/api/profiles/*`, role sync, access grants, and membership status as security-sensitive.
- Gemini calls must stay behind controlled integration/API boundaries. Do not expose Gemini secrets to admin or member clients.
- Production deploys must keep the Clerk live-key guardrail in `scripts/vercel-build.mjs`.

## Verification Guide

Use targeted checks first:

- Docs/config only: `pnpm exec prettier --check <changed files>`
- Shared TypeScript/API contracts: `pnpm run typecheck`
- API route behavior: `pnpm --dir artifacts/api-server test -- <relevant tests>`
- Admin/API smoke: `pnpm run test:e2e:smoke`
- Admin/member UI preview: `pnpm run test:e2e:ui`
- Internal beta release gate: `pnpm run verify:internal-beta`
- Vercel-style build: `pnpm run build:vercel`

Run browser or screenshot checks for meaningful UI changes, especially auth, access, navigation, loading, empty, and error states.

## Local Machine Notes

- This repo already lives on `RAGHAV2`; keep heavy mobile/native tooling and generated emulator assets off the internal disk unless explicitly requested.
- Start only the dev servers needed for the task. Long parallel Node, browser, and mobile sessions can strain this machine.
- Do not edit `node_modules`, `.vercel`, `dist`, `.local`, generated client folders, or build/test output unless the task is specifically about those artifacts.

## Current Task Board

Use `docs/CODEX_TASKS.md` as the standing task and QA guide for Codex-led work. Update it when the operating workflow, verification gates, or launch-readiness posture changes.
