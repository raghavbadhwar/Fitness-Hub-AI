# Real User Test Plan

## Purpose

Prove the upgraded logging flow works for Indian members who eat mixed Indian and Western foods and repeat gym workouts across weeks.

## Test Cohort

- U1: Indian vegetarian strength trainee who logs roti, dal, paneer, rice, curd, protein shakes, and packaged snacks.
- U2: Indian non-vegetarian member who logs home food, restaurant food, eggs/chicken, oats, yogurt, and barcode packaged foods.
- U3: Intermediate lifter who repeats push/pull/legs, expects previous weights, and logs set type, RPE/RIR, and notes.

## Script A: Food Search And Portioning

Steps:

1. Open Nutrition.
2. Add food to Lunch.
3. Search `roti`, `paneer`, `oats`, and one packaged brand query.
4. Select one result.
5. Change servings from 1 to 2.
6. Save and confirm source/confidence appears in the day log.

Pass:

- Search accepts Indian and Western terms.
- Indian portions use familiar labels such as roti, phulka, katori, bowl, or plate when available.
- The user can change servings before save.
- Saved entry preserves source/confidence/provider metadata.

Fail:

- Search only handles Indian foods or only Western foods.
- The user cannot correct serving quantity before saving.
- Source/confidence disappears after save.

Fallback:

- If API search fails, local curated foods must still appear.
- If no match exists, user must be able to use manual entry.

## Script B: Barcode And Label Fallback

Steps:

1. Open Add Meal.
2. Switch to Barcode.
3. Enter a known packaged-food barcode.
4. Tap Lookup barcode.
5. Review populated draft.
6. Edit one macro and save.
7. Repeat with a fake barcode to trigger label fallback.

Pass:

- Known barcode resolves into an editable draft when provider data exists.
- Provider/cached/live status is visible.
- Unknown barcode routes to label/manual entry without blocking logging.
- Corrected barcode/label food is saved locally and synced through the normal nutrition log path.

Fail:

- Barcode miss blocks the user.
- Provider lookup result cannot be edited.
- A failed lookup loses the barcode the user typed.

Fallback:

- `404` becomes label/manual fallback.
- Network/provider error becomes manual fallback.
- Missing API base or signed-out token surfaces a clear manual path.

## Script C: AI Photo Draft Correction

Steps:

1. Open Add Meal.
2. Add a food photo.
3. Review AI result.
4. Change dish name, serving label, grams, ingredients, or macros.
5. Save.

Pass:

- AI result is a draft, not final truth.
- Low/medium confidence is visible.
- Corrections are preserved with `correctionOf` and `correctedAt`.

Fail:

- User must accept AI output unchanged.
- Low-confidence output looks authoritative.

Fallback:

- Analysis error switches to manual entry.

## Script D: Repeated Workout Logging

Steps:

1. Complete a workout with Bench Press sets.
2. Start the same saved plan or quick start again.
3. Confirm previous weight/reps appear before logging.
4. Complete a set and confirm rest timer starts.
5. Adjust set type, RPE/RIR, and set note.

Pass:

- Previous-set values appear for saved plans, quick starts, AI starts, and manually added exercises when history exists.
- Exercise card shows last date, last top set, and best estimated 1RM.
- Basic weight/reps logging remains fast.
- Advanced fields do not block completion.

Fail:

- Previous values only work for saved plans.
- Exercise history is hidden during the active workout.
- Advanced fields break old workout sessions.

Fallback:

- New users see defaults and no broken history placeholders.
- Server sync failure still keeps the workout locally.

## Release Decision

Release-candidate pass requires:

- Automated gymapp tests green.
- API route tests green.
- Typecheck green.
- Internal beta gate green under Node 22.
- At least one human-run pass through Scripts A-D on a real device before production launch.
