# Cal AI And Hevy Level Logging Upgrade

## Goal

Upgrade Fitness Hub AI member logging from a credible tracker into a daily-use premium logger. Food logging should move toward Cal AI-level speed and correction quality. Workout logging should move toward Hevy-level set logging, routine reuse, exercise history, and progression support.

## Current Repo Baseline

- Food logging already supports AI photo analysis, manual entry, static Indian food search, local-first storage, server sync, and API validation.
- Workout logging already supports active sessions, set completion, rest timer, saved plans, server sync, personal records, assigned workouts, and progress views.
- The quality gap is not basic correctness. The gap is daily logging depth, speed, correction, history, and repeat-use intelligence.

## Research Grounding

- Cal AI-level food logging means photo/barcode/search/manual entry, confidence scoring, quick correction, history suggestions, offline-first fallback, and trend-aware macro context.
- Hevy-level workout logging means repeatable routines, copy/start-from-history behavior, previous values, set-level variables, rest timers, exercise history, PR/progress analytics, and fast live-session entry.
- India readiness means the catalogue and AI layer must understand roti/phulka/katori/bowl/plate portions and common Indian dishes while also supporting Western foods, packaged foods, brands, oats, yogurt, protein bars, and mixed modern diets.
- Detailed source notes live in `research-notes.md`.

## Non-Goals

- Do not expose Gemini, barcode provider, database, or Clerk secrets to frontend code.
- Do not replace the existing Expo member app architecture.
- Do not hand-edit generated API client or Zod files.
- Do not build social/community features until core logging is fast and reliable.
- Do not require native-only proof for web-previewable behavior, but document native blockers clearly.

## Product Requirements

### Food Logging

- Users can log by photo, text/manual search, recent/favorite relog, and barcode or nutrition-label fallback.
- Search uses the server food catalogue first, then local curated food fallback when the API/provider path is unavailable.
- Barcode lookup returns an editable draft when provider data exists and routes misses/errors to label/manual entry.
- AI photo results are drafts, not final truth. Users can edit dish name, servings, grams, ingredients, and macros before saving.
- Low-confidence food recognition pushes the user into correction instead of pretending certainty.
- Saved food logs preserve source/provenance, provider/cache status, confidence, serving metadata, ingredients, barcode, brand, and correction history.
- Food history supports fast relogging and weekly trend review.

### Workout Logging

- Starting a routine should preload previous weights and reps where history exists.
- Quick starts, assigned workouts, AI starts, saved plans, and manually added exercises should all use history hydration when history exists.
- Users can log sets quickly with weight, reps, set type, RPE/RIR, completion, and notes.
- Exercise history should be visible before or during a workout.
- Users can create custom exercises without breaking history.
- PRs should go beyond a single estimated 1RM and support practical history-driven progression.
- Rest timer should support per-exercise defaults and quick adjustments.

## Technical Requirements

- Source of truth for API shape remains `lib/api-spec/openapi.yaml`.
- Shared server persistence remains under `artifacts/api-server` and `lib/db`.
- Member app state stays local-first, using migration-safe storage patterns.
- New provider integrations must be server-side abstractions with graceful fallback.
- Verification must start targeted and broaden only when contracts, auth, DB, or generated clients change.

## Acceptance Gates

- Existing food, workout, and AI route tests remain green.
- Old local logs migrate without data loss.
- Existing API consumers remain backward-compatible.
- Browser previews cover visible logging states where possible.
- A real-user test script exists for Indian mixed-diet food logging, barcode fallback, AI photo correction, and repeated workout logging.
- Internal beta gate passes before release-candidate handoff, unless blocked by external credentials or provider setup.
