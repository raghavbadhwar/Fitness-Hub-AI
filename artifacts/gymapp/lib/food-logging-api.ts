import type { FoodEntry, MealType } from "../contexts/NutritionContext";
import { authenticatedJsonRequest } from "./authenticated-api.ts";

export type FoodEntryDraft = Omit<FoodEntry, "id" | "timestamp">;

export interface FoodPortionOption {
  label: string;
  grams?: number;
  milliliters?: number;
  aliases?: string[];
  region?: string;
}

export interface FoodSearchItem {
  id: string;
  source:
    | "open_food_facts"
    | "usda"
    | "nutritionix"
    | "curated"
    | "user"
    | "ai_label"
    | "member_custom";
  sourceProductId?: string;
  catalogItemId?: string;
  memberFoodItemId?: string;
  barcode?: string;
  name: string;
  brand?: string;
  servingLabel: string;
  servingGrams?: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar?: number;
  sodiumMg?: number;
  ingredients: string[];
  allergens: string[];
  portionOptions: FoodPortionOption[];
  confidence: "high" | "medium" | "low";
  provenance: {
    provider: string;
    cached: boolean;
    qualityScore?: number;
  };
}

interface FoodSearchResponse {
  items: FoodSearchItem[];
  fallbackUsed?: string | null;
}

interface FoodLookupResponse {
  item: FoodSearchItem;
  fallbackUsed?: string | null;
}

type RequesterOptions = Parameters<typeof authenticatedJsonRequest<unknown>>[0];
type FoodRequester = <TResponse>(options: RequesterOptions) => Promise<TResponse>;

export interface SearchFoodDraftsResult {
  items: FoodEntryDraft[];
  source: "api" | "fallback";
  fallbackUsed?: string | null;
  error?: string;
}

export interface BarcodeLookupResult {
  status: "found" | "not_found" | "error";
  item: FoodEntryDraft;
  fallbackUsed?: string | null;
  error?: string;
}

export interface CustomFoodPayload {
  catalogItemId?: string;
  name: string;
  brand?: string;
  servingLabel: string;
  servingGrams?: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  portionOptions?: FoodPortionOption[];
  source: FoodEntry["source"];
  confidence: "high" | "medium" | "low";
  isFavorite: boolean;
}

function roundMacro(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundCalories(value: number): number {
  return Math.round(value);
}

function cleanServings(servings: number): number {
  return Number.isFinite(servings) && servings > 0 ? servings : 1;
}

function getFoodId(item: FoodSearchItem): string {
  return item.memberFoodItemId ?? item.catalogItemId ?? item.sourceProductId ?? item.id;
}

function normalizeFoodKey(value: string | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function mergeFoodSearchItems(
  primaryItems: FoodSearchItem[],
  fallbackItems: FoodSearchItem[],
  limit: number,
): FoodSearchItem[] {
  const normalizedLimit = Math.max(1, Math.min(50, Math.round(limit)));
  const seen = new Set<string>();
  const merged: FoodSearchItem[] = [];

  for (const item of [...primaryItems, ...fallbackItems]) {
    const key = [
      normalizeFoodKey(item.name),
      normalizeFoodKey(item.brand),
      item.barcode ? `barcode:${item.barcode}` : "",
    ]
      .filter(Boolean)
      .join("|");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
    if (merged.length >= normalizedLimit) break;
  }

  return merged;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Food lookup failed";
}

function getErrorStatus(error: unknown): number | undefined {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === "number" ? status : undefined;
  }
  return undefined;
}

export function foodSearchItemToEntryDraft(
  item: FoodSearchItem,
  mealType: MealType,
  servings = 1,
  source: FoodEntry["source"] = "search",
): FoodEntryDraft {
  const servingCount = cleanServings(servings);
  return {
    foodId: getFoodId(item),
    name: item.name,
    mealType,
    servings: servingCount,
    servingSize: item.servingLabel,
    calories: roundCalories(item.calories * servingCount),
    protein: roundMacro(item.protein * servingCount),
    carbs: roundMacro(item.carbs * servingCount),
    fat: roundMacro(item.fat * servingCount),
    fiber: roundMacro(item.fiber * servingCount),
    source,
    confidence: item.confidence,
    ...(item.servingGrams ? { servingGrams: item.servingGrams } : {}),
    ...(item.barcode ? { barcode: item.barcode } : {}),
    ...(item.brand ? { brand: item.brand } : {}),
    ...(item.catalogItemId ? { catalogItemId: item.catalogItemId } : {}),
    ...(item.memberFoodItemId ? { memberFoodItemId: item.memberFoodItemId } : {}),
    ...(item.sourceProductId ? { sourceProductId: item.sourceProductId } : {}),
    ...(item.ingredients.length > 0 ? { ingredients: item.ingredients } : {}),
    ...(item.portionOptions.length > 0 ? { portionOptions: item.portionOptions } : {}),
    provider: item.provenance.provider,
    providerCached: item.provenance.cached,
    ...(typeof item.provenance.qualityScore === "number"
      ? { providerQualityScore: item.provenance.qualityScore }
      : {}),
  };
}

export async function searchFoodDrafts({
  getToken,
  query,
  mealType,
  limit = 12,
  fallbackItems = [],
  requester = authenticatedJsonRequest as FoodRequester,
}: {
  getToken: () => Promise<string | null>;
  query: string;
  mealType: MealType;
  limit?: number;
  fallbackItems?: FoodSearchItem[];
  requester?: FoodRequester;
}): Promise<SearchFoodDraftsResult> {
  const cleanedQuery = query.trim();
  const fallbackDrafts = fallbackItems.map((item) => foodSearchItemToEntryDraft(item, mealType));
  if (!cleanedQuery) {
    return { items: fallbackDrafts, source: "fallback", fallbackUsed: "empty_query" };
  }

  try {
    const payload = await requester<FoodSearchResponse>({
      getToken,
      path: `/api/foods/search?q=${encodeURIComponent(cleanedQuery)}&limit=${Math.max(
        1,
        Math.min(20, Math.round(limit)),
      )}`,
      method: "GET",
    });
    const mergedItems = mergeFoodSearchItems(payload.items, fallbackItems, limit);
    return {
      items: mergedItems.map((item) => foodSearchItemToEntryDraft(item, mealType)),
      source: "api",
      fallbackUsed: payload.fallbackUsed ?? null,
    };
  } catch (error) {
    return {
      items: fallbackDrafts,
      source: "fallback",
      fallbackUsed: "local_food_catalog",
      error: getErrorMessage(error),
    };
  }
}

export async function lookupBarcodeFoodDraft({
  getToken,
  barcode,
  mealType,
  requester = authenticatedJsonRequest as FoodRequester,
}: {
  getToken: () => Promise<string | null>;
  barcode: string;
  mealType: MealType;
  requester?: FoodRequester;
}): Promise<BarcodeLookupResult> {
  const cleanedBarcode = barcode.trim();
  try {
    const payload = await requester<FoodLookupResponse>({
      getToken,
      path: `/api/foods/barcode/${encodeURIComponent(cleanedBarcode)}`,
      method: "GET",
    });
    return {
      status: "found",
      item: foodSearchItemToEntryDraft(payload.item, mealType, 1, "barcode"),
      fallbackUsed: payload.fallbackUsed ?? null,
    };
  } catch (error) {
    const status = getErrorStatus(error);
    return {
      status: status === 404 ? "not_found" : "error",
      item: {
        foodId: `label_${cleanedBarcode}`,
        name: "",
        mealType,
        servings: 1,
        servingSize: "Nutrition label",
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        source: "label",
        barcode: cleanedBarcode,
        confidence: "low",
      },
      fallbackUsed: status === 404 ? "manual_or_label" : "manual",
      error: getErrorMessage(error),
    };
  }
}

export function buildCustomFoodPayload(draft: FoodEntryDraft): CustomFoodPayload {
  return {
    catalogItemId: draft.catalogItemId,
    name: draft.name.trim(),
    brand: draft.brand,
    servingLabel: draft.servingSize.trim() || "1 serving",
    servingGrams: draft.servingGrams,
    calories: Math.max(0, roundCalories(draft.calories)),
    protein: Math.max(0, roundMacro(draft.protein)),
    carbs: Math.max(0, roundMacro(draft.carbs)),
    fat: Math.max(0, roundMacro(draft.fat)),
    fiber: Math.max(0, roundMacro(draft.fiber)),
    portionOptions: draft.portionOptions,
    source: draft.source ?? "manual",
    confidence: draft.confidence ?? "medium",
    isFavorite: false,
  };
}

export async function saveCustomFoodDraft({
  getToken,
  draft,
  requester = authenticatedJsonRequest as FoodRequester,
}: {
  getToken: () => Promise<string | null>;
  draft: FoodEntryDraft;
  requester?: FoodRequester;
}): Promise<void> {
  await requester({
    getToken,
    path: "/api/foods/custom",
    method: "POST",
    body: buildCustomFoodPayload(draft),
  });
}
