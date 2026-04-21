# Fitness Hub AI

Fitness Hub AI is a pnpm workspace for an AI-assisted gym product with three core surfaces:

- an owner-only admin web app
- an Expo member app for mobile and web
- a shared Express API with Clerk auth, Drizzle, and Gemini-backed AI flows

The repository is organized as a monorepo because the product shares auth rules, API contracts, database schema, generated clients, and internal automation tooling.

## Workspace Overview

| Path                         | Purpose                                                      |
| ---------------------------- | ------------------------------------------------------------ |
| `artifacts/admin`            | Owner-facing React + Vite admin panel served under `/admin/` |
| `artifacts/gymapp`           | Expo member app for iOS, Android, and web                    |
| `artifacts/api-server`       | Express 5 API mounted under `/api/*`                         |
| `lib/api-spec`               | OpenAPI source of truth and Orval codegen                    |
| `lib/api-client-react`       | Generated React Query client                                 |
| `lib/api-zod`                | Generated Zod schemas from the OpenAPI spec                  |
| `lib/db`                     | Shared Drizzle schema, migrations, and database utilities    |
| `lib/integrations-gemini-ai` | Gemini integration helpers                                   |
| `scripts`                    | Operational scripts such as secret preflight checks          |
| `plugins`                    | Repo-local Codex plugin bundles used for operator workflows  |
| `docs`                       | Architecture diagrams and internal runbooks                  |

## Tech Stack

- React + Vite for the admin app
- Expo Router + React Native for the member app
- Express 5 for the API
- Clerk for authentication and role-aware access
- Drizzle + PostgreSQL for persistence
- OpenAPI + Orval + Zod for shared API contracts
- Gemini for AI chat, food analysis, and workout assistance
- Playwright for end-to-end smoke coverage

## Quick Start

### 1. Install dependencies

This repo uses `pnpm` only.

```bash
pnpm install
```

### 2. Configure environment variables

Copy the example file and fill in the required values:

```bash
cp .env.example .env.local
```

At minimum, plan to provide:

- Clerk keys
- database URLs
- Gemini API configuration
- any app host/base URL overrides needed for local development

See [.env.example](./.env.example) for the current template.

### 3. Start the apps

Run these in separate terminals as needed:

```bash
pnpm run dev:api
pnpm run dev:admin
pnpm run dev:member
```

Notes:

- The API defaults to `http://localhost:4000`
- The admin app defaults to `http://localhost:4173/admin/`
- The Expo app defaults to Metro on port `8081`
- If `4173` is busy, Vite may auto-shift the admin app to the next open port

## Common Scripts

| Command                         | What it does                                                    |
| ------------------------------- | --------------------------------------------------------------- |
| `pnpm run build`                | Typechecks the workspace and runs package build scripts         |
| `pnpm run typecheck`            | Runs the root TypeScript project references build               |
| `pnpm run format`               | Formats repository source, docs, and config files with Prettier |
| `pnpm run format:check`         | Checks formatting without rewriting files                       |
| `pnpm run dev:api`              | Starts the API server                                           |
| `pnpm run dev:admin`            | Starts the admin web app                                        |
| `pnpm run dev:member`           | Starts the Expo member app                                      |
| `pnpm run test:e2e:smoke`       | Runs the admin/API smoke Playwright test                        |
| `pnpm run test:e2e:ui`          | Runs the UI preview Playwright test suite                       |
| `pnpm run verify:internal-beta` | Runs the internal beta verification flow with secret preflight  |

## Development Conventions

- Use `pnpm` only. The root preinstall script rejects npm and yarn.
- Treat `lib/api-spec/openapi.yaml` as the API contract source of truth.
- Do not hand-edit generated files in `lib/api-client-react/src/generated` or `lib/api-zod/src/generated`.
- Keep secrets in `.env.local`, never in committed files.
- Reuse shared workspace packages via `@workspace/*` imports instead of duplicating types or API helpers.
- Admin access is owner-only and should stay enforced on both the client and server.
- The `plugins/` folder contains repo-local Codex plugins and is optional for app runtime.

## Repository Hygiene

This repo now includes root-level formatting and consistency rules:

- `.editorconfig` for base editor behavior
- `.gitattributes` for line-ending normalization
- `prettier.config.mjs` for shared formatting settings
- `.prettierignore` to avoid formatting generated and machine-local artifacts

Run `pnpm run format` before large documentation or config changes, and `pnpm run format:check` in verification flows.

## Docs

- [Contributor guide](./CONTRIBUTING.md)
- [Security policy](./SECURITY.md)
- [Architecture diagrams](./docs/fitness-hub-diagrams.md)
- [Internal beta secret rotation runbook](./docs/internal-beta/secret-rotation-runbook.md)
- [Workspace notes](./replit.md)

## License

This repository is licensed under the [MIT License](./LICENSE).
