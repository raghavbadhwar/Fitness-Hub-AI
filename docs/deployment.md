# Deployment Guide

Fitness Hub AI is now hosted through standard web deployment tooling with no legacy platform-specific runtime files.

## Recommended Production Shape

- Vercel hosts the member web app at `/`.
- Vercel hosts the admin app at `/admin/`.
- Vercel hosts the Express API as serverless functions under `/api/*`.
- Expo/EAS can publish native iOS and Android builds later using the same API domain.

## Required Vercel Environment Variables

Set these in the Vercel project before production deploys:

- `CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `ADMIN_ALLOWED_EMAILS`
- `DATABASE_URL`
- `AI_INTEGRATIONS_GEMINI_API_KEY`
- `AI_INTEGRATIONS_GEMINI_BASE_URL` if using a custom Gemini-compatible endpoint

Optional native mobile build variables:

- `EXPO_PUBLIC_API_BASE_URL` for native builds when the app is not served from the same web origin
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
