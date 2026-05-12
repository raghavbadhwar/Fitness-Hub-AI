import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import type { MealType } from "../contexts/NutritionContext";
import type { FoodSearchItem } from "./food-logging-api.ts";

async function loadFoodLoggingApi() {
  mock.module("react-native", {
    namedExports: {
      Platform: { OS: "web" },
    },
  });

  const moduleUrl = new URL(
    `./food-logging-api.ts?nonce=${Date.now()}-${Math.random()}`,
    import.meta.url,
  );
  return (await import(moduleUrl.href)) as typeof import("./food-logging-api.ts");
}

afterEach(() => {
  mock.reset();
});

const mealType: MealType = "lunch";

const rotiSearchItem: FoodSearchItem = {
  id: "curated-roti",
  source: "curated",
  sourceProductId: "curated-roti",
  name: "Roti / Chapati",
  servingLabel: "1 medium roti",
  servingGrams: 40,
  calories: 120,
  protein: 3.5,
  carbs: 22,
  fat: 3,
  fiber: 3,
  ingredients: ["whole wheat flour", "water"],
  allergens: ["wheat"],
  portionOptions: [{ label: "1 phulka", grams: 30 }],
  confidence: "medium",
  provenance: { provider: "curated-india-aware-fallback", cached: true, qualityScore: 60 },
};

const paneerSearchItem: FoodSearchItem = {
  id: "local-paneer-tikka",
  source: "curated",
  sourceProductId: "paneer_tikka",
  name: "Paneer Tikka",
  servingLabel: "4 pieces (150g)",
  servingGrams: 150,
  calories: 280,
  protein: 18,
  carbs: 8,
  fat: 20,
  fiber: 2,
  ingredients: [],
  allergens: ["milk"],
  portionOptions: [{ label: "4 pieces", grams: 150 }],
  confidence: "medium",
  provenance: { provider: "local-indian-food-catalog", cached: true, qualityScore: 55 },
};

test("foodSearchItemToEntryDraft preserves source, portion, confidence, and provenance", async () => {
  const { foodSearchItemToEntryDraft } = await loadFoodLoggingApi();
  const draft = foodSearchItemToEntryDraft(rotiSearchItem, mealType, 2);

  assert.equal(draft.foodId, "curated-roti");
  assert.equal(draft.name, "Roti / Chapati");
  assert.equal(draft.mealType, "lunch");
  assert.equal(draft.servings, 2);
  assert.equal(draft.servingSize, "1 medium roti");
  assert.equal(draft.calories, 240);
  assert.equal(draft.protein, 7);
  assert.equal(draft.carbs, 44);
  assert.equal(draft.fat, 6);
  assert.equal(draft.fiber, 6);
  assert.equal(draft.source, "search");
  assert.equal(draft.confidence, "medium");
  assert.equal(draft.servingGrams, 40);
  assert.deepEqual(draft.ingredients, ["whole wheat flour", "water"]);
  assert.equal(draft.sourceProductId, "curated-roti");
  assert.equal(draft.provider, "curated-india-aware-fallback");
  assert.equal(draft.providerCached, true);
  assert.equal(draft.providerQualityScore, 60);
});

test("searchFoodDrafts encodes the query and falls back to caller-owned local results", async () => {
  const { searchFoodDrafts } = await loadFoodLoggingApi();
  const calls: Array<{ path: string; method?: string }> = [];
  const drafts = await searchFoodDrafts({
    getToken: async () => "token",
    query: "paneer tikka",
    mealType,
    fallbackItems: [rotiSearchItem],
    requester: async (options) => {
      calls.push({ path: options.path, method: options.method });
      throw new Error("offline");
    },
  });

  assert.deepEqual(calls, [{ path: "/api/foods/search?q=paneer%20tikka&limit=12", method: "GET" }]);
  assert.equal(drafts.source, "fallback");
  assert.equal(drafts.error, "offline");
  assert.equal(drafts.items[0]?.name, "Roti / Chapati");
});

test("searchFoodDrafts keeps local catalog matches when API returns a narrow result", async () => {
  const { searchFoodDrafts } = await loadFoodLoggingApi();
  const drafts = await searchFoodDrafts({
    getToken: async () => "token",
    query: "paneer",
    mealType,
    limit: 10,
    fallbackItems: [rotiSearchItem, paneerSearchItem],
    requester: async <TResponse>() =>
      ({
        items: [rotiSearchItem],
        fallbackUsed: null,
      }) as TResponse,
  });

  assert.equal(drafts.source, "api");
  assert.deepEqual(
    drafts.items.map((item) => item.name),
    ["Roti / Chapati", "Paneer Tikka"],
  );
});

test("lookupBarcodeFoodDraft returns editable barcode draft and provider fallback metadata", async () => {
  const { lookupBarcodeFoodDraft } = await loadFoodLoggingApi();
  const result = await lookupBarcodeFoodDraft({
    getToken: async () => "token",
    barcode: "8901234567890",
    mealType,
    requester: async <TResponse>(options: { path: string; method?: string }) => {
      assert.equal(options.path, "/api/foods/barcode/8901234567890");
      return {
        item: {
          ...rotiSearchItem,
          id: "off-8901234567890",
          source: "open_food_facts",
          sourceProductId: "8901234567890",
          barcode: "8901234567890",
          name: "Greek Yogurt",
          brand: "Epigamia",
          servingLabel: "1 cup",
          servingGrams: 100,
          calories: 96,
          protein: 8,
          carbs: 9,
          fat: 3,
          fiber: 0,
          confidence: "high",
          provenance: { provider: "open_food_facts", cached: false, qualityScore: 84 },
        },
        fallbackUsed: null,
      } as TResponse;
    },
  });

  assert.equal(result.status, "found");
  assert.equal(result.item.name, "Greek Yogurt");
  assert.equal(result.item.source, "barcode");
  assert.equal(result.item.barcode, "8901234567890");
  assert.equal(result.item.brand, "Epigamia");
  assert.equal(result.item.provider, "open_food_facts");
  assert.equal(result.item.providerCached, false);
});

test("lookupBarcodeFoodDraft turns barcode miss into label-entry fallback", async () => {
  const { lookupBarcodeFoodDraft } = await loadFoodLoggingApi();
  const result = await lookupBarcodeFoodDraft({
    getToken: async () => "token",
    barcode: "8900000000000",
    mealType,
    requester: async () => {
      const error = new Error("Food barcode not found") as Error & { status?: number };
      error.status = 404;
      throw error;
    },
  });

  assert.equal(result.status, "not_found");
  assert.equal(result.fallbackUsed, "manual_or_label");
  assert.equal(result.item.foodId, "label_8900000000000");
  assert.equal(result.item.source, "label");
  assert.equal(result.item.barcode, "8900000000000");
});

test("buildCustomFoodPayload stores corrected barcode or manual foods without logging-only fields", async () => {
  const { buildCustomFoodPayload, foodSearchItemToEntryDraft } = await loadFoodLoggingApi();
  const payload = buildCustomFoodPayload({
    ...foodSearchItemToEntryDraft(rotiSearchItem, mealType, 1),
    source: "label",
    barcode: "8900000000000",
    calories: 118,
  });

  assert.deepEqual(payload, {
    catalogItemId: undefined,
    name: "Roti / Chapati",
    brand: undefined,
    servingLabel: "1 medium roti",
    servingGrams: 40,
    calories: 118,
    protein: 3.5,
    carbs: 22,
    fat: 3,
    fiber: 3,
    portionOptions: [{ label: "1 phulka", grams: 30 }],
    source: "label",
    confidence: "medium",
    isFavorite: false,
  });
});
