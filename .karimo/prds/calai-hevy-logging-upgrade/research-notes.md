# Research Notes

Grounding checked on 2026-05-10 before end-to-end implementation.

## Product Benchmarks

- Cal.ai positions food logging around photo scan, packaged foods, barcode support, confidence scoring, quick edits, history-based suggestions, offline-first sync, weekly averages, and goal-adaptive macro targets. Source: https://www.calai-usa.com/
- Hevy emphasizes reusable routines, copying prior workouts, previous values, set-level reps/weight/RPE/notes, rest timers, exercise history, PR/progress analysis, and workout statistics. Source: https://www.hevyapp.com/features/best-way-to-track-workouts/

## Data Benchmarks

- Open Food Facts is suitable as the first packaged-food barcode provider because it exposes barcode lookup APIs and reusable product nutrition/ingredient/allergen data. Source: https://test-wiki.openfoodfacts.org/index.php?mobileaction=toggle_view_desktop&title=API%2FRead%2FProduct
- Indian Food Composition Tables 2017 from ICMR-NIN are the correct India-specific reference direction for raw ingredient and common-food nutrition grounding. Source: https://www.nin.res.in/ebooks/IFCT2017.pdf

## Implementation Implications

- Food outputs must be editable drafts with source, confidence, serving metadata, provider provenance, and fallback path, not final AI truth.
- India support needs katori/roti/phulka/bowl/plate style portions while still supporting Western packaged foods and search terms.
- Workout logging must make the repeated-session path fast: start from a routine, preload prior values, expose last/best history during the active session, and keep set type/RPE/RIR/notes available without blocking basic logging.
- Provider and AI calls must stay behind the API boundary; the Expo app should handle offline/manual fallback without provider keys.
