# Observability and AI Cost Controls

The API uses `pino-http` request logging. Request log serializers keep the method, path without query
string, response status, and request id; handlers should add only privacy-safe operational fields.

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
