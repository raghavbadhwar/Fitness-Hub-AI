# Observability and AI Cost Controls

The API uses `pino-http` request logging. Request log serializers keep the method, path without query
string, response status, and request id; handlers should add only privacy-safe operational fields.

## API Request Context

Every `/api/*` request log can include these safe fields when the request reaches the relevant auth
or access middleware:

- `route`: API path without query string
- `userId`: Clerk user id, when authenticated
- `gymId`: tenant id, when resolved by owner/member access checks
- `role`: owner, trainer, or member role, when resolved
- `req.id`: pino request id, used to correlate the completion log with any handler error log

The global API error handler logs unhandled failures with the same route, request id, user id, gym id,
and role context, then returns a generic `500` JSON response. Do not add email addresses, bearer
tokens, cookies, prompt bodies, image payloads, or database URLs to request logs.

## AI Logging

AI routes log:

- route name
- Clerk user id
- Gemini model
- chat message count
- food-image MIME type and payload size
- rate-limit hits
- AI parse/generation failures

Do not log:

- bearer tokens or Clerk secrets
- full prompts or chat messages
- full image payloads
- raw health, nutrition, workout, or body-measurement records
- Gemini API keys or provider responses that may contain user content

## Configurable AI Limits

Use provider-managed env vars for production:

| Variable                       | Default   | Purpose                                       |
| ------------------------------ | --------- | --------------------------------------------- |
| `AI_RATE_LIMIT_MAX_PER_MINUTE` | `20`      | Per-authenticated-user AI requests per minute |
| `AI_MAX_IMAGE_BASE64_BYTES`    | `5000000` | Maximum food-photo base64 payload size        |
| `AI_MAX_CHAT_MESSAGES`         | `30`      | Maximum client chat history messages          |
| `AI_MAX_CHAT_MESSAGE_CHARS`    | `4000`    | Maximum UTF-8 bytes per chat message          |

Lower these limits for staged load testing. Raise them only after checking Gemini spend, API latency,
and body-size pressure.

## Monitoring Recommendations

- Alert on repeated `AI rate limit exceeded` logs by user id.
- Track counts of `AI food image payload rejected` to identify bad client compression behavior.
- Track `AI chat error`, `Food analysis JSON parse error`, and `Workout suggestion JSON parse error`
  separately because they indicate different provider or prompt-contract failures.
- Track `Admin access denied` warnings for unexpected owner-access failures after Clerk or allowlist
  changes.

## Failure Runbooks

Auth failures:
Check the `route`, `statusCode`, `userId`, `gymId`, and `role` fields first. `401` usually means
missing or expired Clerk auth. `403` usually means pending, revoked, or non-owner access. Verify
Clerk metadata and `ADMIN_GYM_OWNER_EMAILS` before changing code.

Database failures:
Look for route-specific DB error logs with the same `req.id`. Confirm `DATABASE_URL` points to the
runtime role, migrations have been applied, and tenant filters include `gymId`.

AI failures:
Separate `AI rate limit exceeded`, payload validation rejects, Gemini generation failures, and JSON
parse failures. Do not retry large payloads blindly; first check configured AI limits and provider
status.

E2E failures:
CI runs deterministic admin/API browser checks without `.env.local` or real secrets. Full member
auth flows require local or pre-release Clerk test config and should be run with:

```bash
mise exec node@22 -- pnpm run test:e2e:member
```

Deployment failures:
Use the production preflight and Vercel build logs together. A missing `CLERK_*`, `DATABASE_URL`, or
`AI_INTEGRATIONS_GEMINI_*` variable is an environment issue, not an app runtime regression.
