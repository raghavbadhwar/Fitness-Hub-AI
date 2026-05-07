# Notification Preferences Foundation

Fitness Hub AI stores member reminder preferences, but it does not send real push or email messages yet.

## Covered Reminder Types

- Class reminders: member opt-in for booked class reminders.
- Trainer assignment notifications: future server events can notify members when a trainer assigns a workout.
- Workout reminders: member opt-in for planned workout nudges.
- Email channel: preference only until a provider such as Resend, SendGrid, or AWS SES is configured server-side.
- Push channel: preference only until Expo push tokens, consent, and delivery jobs are configured.

## Current Implementation

- Preferences are stored in `member_notification_preferences`.
- The API exposes `GET /api/notifications/preferences` and `PUT /api/notifications/preferences`.
- Preferences are scoped by `gymId + memberClerkId` and require approved access.
- The member profile screen can update class reminders, workout reminders, lead time, email preference, and push preference.
- No scheduler, email provider, push provider, or irreversible notification action is active.

## Delivery Requirements Before Real Sending

- Add server-owned provider secrets only in provider-managed environment variables.
- Store Expo push tokens with device/user ownership and revocation support.
- Add scheduled jobs with idempotency keys and duplicate-send prevention.
- Add quiet hours, timezone handling, unsubscribe semantics, and audit logs.
- Keep provider calls server-side; clients should only manage consent/preferences.
- Add integration tests with mocked providers before enabling production delivery.
