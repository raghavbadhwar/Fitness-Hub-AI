# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## GymOS — AI-Powered Gym Management App

### artifacts/gymapp (Expo / React Native)

Mobile app for gym owners, trainers, and members. All data stored in AsyncStorage.

**Key Features:**
- **Auth**: Clerk v3 email/password (Core v3 API - `useSignIn().signIn.password()`, `signIn.finalize()`)
- **Onboarding**: 4-step flow (personal info, fitness goals, diet preferences, role selection)
- **Home**: Calorie ring, macro bars, streaks, today's classes, recent workouts
- **Nutrition**: 6 meal types, 150+ Indian foods database, AI photo analysis via Gemini Vision
- **Workout**: AI workout generator, quick-start templates, live session tracker, PRs
- **Schedule**: Weekly calendar, class enrollment (owner/trainer can manage)
- **AI Coach**: Gemini streaming chat, Indian nutrition awareness
- **Progress**: Weekly charts (SVG bar charts), goal tracking, PR records
- **Profile**: BMI calculator, macro targets, edit profile, sign out

**Design Tokens:** Dark theme - saffron/orange `#FF6B00`, deep navy `#0C0E1A` background

**Contexts:**
- `AppContext`: user profile + BMR/TDEE calculation  
- `NutritionContext`: meals/diary/water, `@gymapp_nutrition`
- `WorkoutContext`: sessions/PRs, `@gymapp_sessions`, `@gymapp_prs`
- `ScheduleContext`: classes + enrollments, `@gymapp_classes`, `@gymapp_enrolled`

**AsyncStorage Keys:** `@gymapp_profile`, `@gymapp_nutrition`, `@gymapp_sessions`, `@gymapp_prs`, `@gymapp_classes`, `@gymapp_enrolled`

**Important Clerk v3 API Pattern (Expo):**
```ts
const { signIn, errors, fetchStatus } = useSignIn(); // NOT setActive/isLoaded
await signIn.password({ emailAddress, password });    // NOT signIn.create()
await signIn.finalize({ navigate: ... });
```

### artifacts/api-server (Express)

AI endpoints for GymOS:
- `POST /api/ai/analyze-food` — Gemini Flash Vision photo food analysis
- `POST /api/ai/chat` — SSE streaming chat with Gemini
- `POST /api/ai/workout-suggestion` — AI workout recommendations

Uses `@workspace/integrations-gemini-ai`, model: `gemini-2.5-flash-preview-04-17`

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
