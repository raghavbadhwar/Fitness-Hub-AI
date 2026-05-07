# Billing And Membership Foundation

Fitness Hub AI does not collect card details, create charges, or process subscriptions directly.

## Membership Model

- Membership plans should be defined by the gym owner: plan name, price, billing interval, access rules, and cancellation policy.
- Member state should eventually track `active`, `trialing`, `past_due`, `cancelled`, or `none`.
- The app should treat billing state as access metadata, not as proof of payment by itself.
- Admin revenue analytics should not be shown until real provider-backed billing data exists.

## Preferred Provider

Stripe is the preferred first billing provider because it supports hosted Checkout, Customer Portal, subscriptions, invoices, and webhooks.

Recommended flow:

- The server creates Stripe Checkout or Customer Portal sessions.
- The client redirects to Stripe-hosted pages and never collects card details directly.
- Stripe sends webhook events to the API.
- The API verifies webhook signatures before updating membership status.
- Membership status is read from server-owned data, not from client claims.

## Webhook Events To Handle

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

## Security Requirements

- Keep Stripe secret keys and webhook signing secrets server-side only.
- Do not commit provider secrets or machine-local payment state.
- Use idempotency for webhook processing.
- Store provider IDs separately from user-entered profile data.
- Log provider event IDs and membership status changes without logging card, token, or payment method details.
- Add tests with mocked Stripe events before enabling live billing.

## Current Safe Boundary

- No fake payment capture exists.
- No Stripe placeholders were added to `.env.example` because no integration code was introduced.
- No membership status schema was added yet; it should be added with the first real server-side billing/status API so access logic can be tested in the same change.
