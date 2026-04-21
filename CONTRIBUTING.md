# Contributing

## Ground Rules

- Use `pnpm` only.
- Edit the canonical app roots: `artifacts/admin`, `artifacts/gymapp`, and `artifacts/api-server`.
- Keep secrets in `.env.local` and out of committed files.
- Prefer shared workspace packages over copy-pasted contracts or utilities.

## Before You Start

1. Install dependencies with `pnpm install`.
2. Copy `.env.example` to `.env.local` and fill in the required values.
3. Start only the surfaces you need:
   - `pnpm run dev:api`
   - `pnpm run dev:admin`
   - `pnpm run dev:member`

## Formatting

- Run `pnpm run format` to apply the repo formatting rules.
- Run `pnpm run format:check` when you want a non-mutating verification pass.
- Generated files and machine-local directories are intentionally ignored by Prettier.

## Contracts and Codegen

- Treat `lib/api-spec/openapi.yaml` as the API source of truth.
- Do not hand-edit generated files in:
  - `lib/api-client-react/src/generated`
  - `lib/api-zod/src/generated`
- After contract changes, regenerate clients and schemas:

```bash
pnpm --filter @workspace/api-spec run codegen
```

## Verification

Use the smallest verification step that proves the change:

- Full workspace typecheck:

```bash
pnpm run typecheck
```

- Full workspace build:

```bash
pnpm run build
```

- Admin/API smoke coverage:

```bash
pnpm run test:e2e:smoke
```

- UI preview coverage:

```bash
pnpm run test:e2e:ui
```

- Internal beta verification with preflight:

```bash
pnpm run verify:internal-beta
```

## Auth and Access Rules

- Keep owner-only access enforced on both the admin client and the server.
- Be careful around `/api/admin/*`, `/api/profiles/*`, and role-sync behavior.
- Member/mobile flows often have both local-first state and API-synced state; preserve both paths when changing behavior.

## Pull Request Checklist

- The change is limited to the intended surface area.
- Docs and config are updated if the developer workflow changed.
- Formatting has been checked.
- The most relevant typecheck, test, or smoke command has been run.
- No secrets, machine-local files, or oversized artifacts are staged.
