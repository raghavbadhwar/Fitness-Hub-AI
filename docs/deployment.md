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
- `AI_INTEGRATIONS_GEMINI_BASE_URL` if using a custom Gemini-compatible endpoint

Development Clerk keys (`pk_test_...` / `sk_test_...`) are only suitable for local testing. The deployed Vercel app needs production Clerk keys and the production domain configured in Clerk.

Production builds fail fast when Clerk live keys are missing or when development keys are used. Local `.env` files are also excluded from Vercel uploads, so production deploys must be driven by Vercel-managed environment variables rather than a developer machine.

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

## Local Verification

Run the same release gate before pushing:

```bash
pnpm run verify:internal-beta
```

For a Vercel-style local build:

```bash
pnpm run build:vercel
```
