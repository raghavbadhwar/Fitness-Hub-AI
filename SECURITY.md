# Security Policy

## Supported Branch

Security fixes should target the `main` branch unless there is an explicit release branch strategy in place.

## Reporting a Vulnerability

- Do not open a public issue with exploit details or live secrets.
- Contact the repository owner privately with:
  - affected surface
  - reproduction steps
  - expected impact
  - any relevant logs or screenshots with secrets removed
- If credentials may have been exposed, rotate them immediately and document the follow-up.

## Secret Hygiene

- Keep real credentials in `.env.local` only.
- Use [.env.example](./.env.example) as the template for required variables.
- Never commit API keys, database passwords, Clerk secrets, or bearer tokens.
- Before internal beta work, run:

```bash
pnpm run preflight:beta-secrets
```

- For credential cleanup and rotation guidance, see [docs/internal-beta/secret-rotation-runbook.md](./docs/internal-beta/secret-rotation-runbook.md).

## Automated Security Checks

This repo uses GitHub automation that does not require Clerk, Gemini, database, or payment secrets:

- Dependabot checks pnpm workspace dependencies and GitHub Actions weekly.
- CodeQL scans JavaScript and TypeScript on pull requests, pushes to `main`, and a weekly schedule.
- CI runs `pnpm audit --audit-level high --prod` against production dependencies.

Treat security automation failures as release blockers unless the finding is documented, accepted, and tracked with a clear remediation owner.

## Sensitive Areas in This Repo

Changes in these areas should be reviewed carefully:

- Clerk auth and owner-role enforcement
- `/api/admin/*` and `/api/profiles/*` access control
- database connection and migration scripts
- Gemini integration configuration
- any repo-local automation or plugin surface that can access external services
