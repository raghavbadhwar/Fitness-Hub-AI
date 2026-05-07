# Deployment Guide

Fitness Hub AI is now hosted through standard web deployment tooling with no legacy platform-specific runtime files.

## Recommended Production Shape

- Vercel hosts the member web app at `/`.
- Vercel hosts the admin app at `/admin/`.
- Vercel hosts the Express API as serverless functions under `/api/*`.
- Expo/EAS can publish native iOS and Android builds later using the same API domain.

## Required Vercel Environment Variables

Set these in the Vercel project before production deploys:

- `CLERK_PUBLISHABLE_KEY` from a Clerk production instance (`pk_live_...`)
- `CLERK_SECRET_KEY` from the same Clerk production instance (`sk_live_...`)
- `ADMIN_ALLOWED_EMAILS`
- `DATABASE_URL`
- `AI_INTEGRATIONS_GEMINI_API_KEY`
- `AI_INTEGRATIONS_GEMINI_BASE_URL`
- `DEFAULT_GYM_ID`, optional when the default `gymos-main` tenant is acceptable
- `CORS_ALLOWED_ORIGINS`, recommended for explicit production admin/member origins

Development Clerk keys (`pk_test_...` / `sk_test_...`) are only suitable for local testing. The deployed Vercel app needs production Clerk keys and the production domain configured in Clerk.

Production builds fail fast when required production variables are missing, when placeholder values
are still present, or when Clerk development keys are used. Local `.env` files are also excluded from
Vercel uploads, so production deploys must be driven by Vercel-managed environment variables rather
than a developer machine.

The deployment preflight runs through:

```bash
pnpm run preflight:production-env
```

It skips normal local builds and enforces the required values when `VERCEL=1` and
`VERCEL_ENV=production`.

## Clerk Production Setup

In Clerk, configure the production app for:

- member web app domain: `https://fitness-hub-ai-five.vercel.app`
- admin web path: `https://fitness-hub-ai-five.vercel.app/admin/`
- frontend API proxy URL: `https://fitness-hub-ai-five.vercel.app/api/__clerk`
- owner accounts: set `publicMetadata.role` to `owner`
- member/trainer accounts: managed from the admin app through email access grants

Keep `VITE_CLERK_PROXY_URL` and `EXPO_PUBLIC_CLERK_PROXY_URL` unset unless a custom domain needs an override; the Vercel build defaults both web apps to `/api/__clerk`.

Optional native mobile build variables:

- `EXPO_PUBLIC_API_BASE_URL` for native builds when the app is not served from the same web origin
- `EXPO_PUBLIC_CLERK_PROXY_URL` as an absolute URL for native builds, for example `https://fitness-hub-ai-five.vercel.app/api/__clerk`
- `EXPO_PUBLIC_CLERK_GOOGLE_WEB_CLIENT_ID`
- `EXPO_PUBLIC_CLERK_GOOGLE_IOS_CLIENT_ID`
- `EXPO_PUBLIC_CLERK_GOOGLE_ANDROID_CLIENT_ID`

## Database Migration Steps

1. Provision the production Postgres database.
2. Set `DATABASE_URL` to the app-runtime role, not a superuser connection.
3. Keep `DATABASE_ADMIN_URL` out of Vercel unless a controlled migration job explicitly needs it.
4. Apply schema changes from a trusted operator machine or CI migration job using the existing
   Drizzle workflow:

```bash
pnpm --filter @workspace/db run push
```

5. Re-run API route tests against a safe staging database before promoting production traffic.

## Gemini Setup

The API imports `@workspace/integrations-gemini-ai`, which requires both:

- `AI_INTEGRATIONS_GEMINI_API_KEY`
- `AI_INTEGRATIONS_GEMINI_BASE_URL`

Use the provider-managed Gemini endpoint or a trusted Gemini-compatible endpoint. Do not expose
Gemini secrets to the admin or member clients; all AI calls must stay behind `/api/ai/*`.

## Expo and EAS Notes

For native builds, set `EXPO_PUBLIC_API_BASE_URL` to the deployed API origin, for example:

```bash
EXPO_PUBLIC_API_BASE_URL=https://fitness-hub-ai-five.vercel.app
EXPO_PUBLIC_CLERK_PROXY_URL=https://fitness-hub-ai-five.vercel.app/api/__clerk
```

Keep native Clerk OAuth client IDs in the Expo/EAS environment rather than committed config files.

## Local Verification

Run the same release gate before pushing:

```bash
pnpm run verify:internal-beta
```

For a Vercel-style local build:

```bash
pnpm run build:vercel
```

## Production Smoke Checklist

After deploy, verify:

- `GET /api/healthz` returns healthy JSON.
- Owner can sign in at `/admin/` and `/api/admin/access` resolves owner access.
- Member can sign in to the member app and `/api/profiles/access-check` returns the expected access
  state.
- `/api/classes` returns the class list for an approved member.
- `/api/ai/history` and one bounded AI request work only when Gemini env vars are configured.
- Revoked or pending members see the blocked/approval state instead of private app data.
