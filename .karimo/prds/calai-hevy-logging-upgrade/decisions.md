# Decisions

## 2026-05-10

- Use KARIMO feature-branch mode on `codex/calai-hevy-logging-upgrade`.
- Start with repo-side logging speed and data quality before provider-dependent barcode or native-device work.
- Treat AI food output as a correctable draft, not a final authoritative log.
- Prioritize workout previous-set autofill and exercise history before broader coaching because that has the highest Hevy-level daily-use impact.
- Keep barcode lookup behind an API abstraction so provider choice, licensing, and keys do not leak into the Expo app.
- Execute T07 before W1/W2 because previous-set autofill is self-contained in the member app and gives immediate Hevy-style workout logging value without schema or provider decisions.
- Ship barcode as a metadata-preserving manual fallback in this slice, not a third-party lookup integration. Provider lookup still belongs behind the API once keys/licensing are chosen.
- Update OpenAPI and regenerated clients because nutrition/workout JSON metadata is now part of synced API payloads.
- Run the final release gate with `mise x node@22.22.2` because the default shell is Node 24 and the repo release preflight intentionally requires Node 22.x.
- Promote barcode from placeholder to server lookup now that `/api/foods/barcode/:barcode` exists; keep miss/error behavior as label/manual fallback.
- Use local curated Indian foods as the offline fallback inside member search while preferring the server catalogue when signed in and online.
- Hydrate previous workout sets in the shared `startSession` path so quick starts, assigned workouts, AI starts, saved plans, and manually added exercises behave consistently.
