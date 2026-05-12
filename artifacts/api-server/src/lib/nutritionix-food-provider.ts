import type { FoodCatalogSource, FoodPortionOption } from "@workspace/db";

export interface ProviderFoodSearchItem {
  id: string;
  source: FoodCatalogSource | "member_custom";
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

export type NutritionixSearchStatus =
  | "hit"
  | "miss"
  | "not_configured"
  | "provider_error"
  | "skipped";

export interface NutritionixSearchOutcome {
  items: ProviderFoodSearchItem[];
  status: NutritionixSearchStatus;
}

interface NutritionixConfig {
  appId: string;
  apiKey: string;
  remoteUserId: string;
  timeoutMs: number;
}

interface NutritionixInstantSuggestion {
  food_name?: unknown;
  brand_name?: unknown;
  nix_item_id?: unknown;
  tag_id?: unknown;
  serving_qty?: unknown;
  serving_unit?: unknown;
  serving_weight_grams?: unknown;
  nf_calories?: unknown;
}

interface NutritionixInstantResponse {
  common?: NutritionixInstantSuggestion[];
  branded?: NutritionixInstantSuggestion[];
}

interface NutritionixNutrientsFood {
  food_name?: unknown;
  brand_name?: unknown;
  nix_item_id?: unknown;
  tag_id?: unknown;
  serving_qty?: unknown;
  serving_unit?: unknown;
  serving_weight_grams?: unknown;
  nf_calories?: unknown;
  nf_protein?: unknown;
  nf_total_carbohydrate?: unknown;
  nf_total_fat?: unknown;
  nf_dietary_fiber?: unknown;
  nf_sugars?: unknown;
  nf_sodium?: unknown;
}

interface NutritionixFoodResponse {
  foods?: NutritionixNutrientsFood[];
}

interface NutritionixSuggestion {
  kind: "common" | "branded";
  name: string;
  brand?: string;
  itemId?: string;
  tagId?: string;
}

const NUTRITIONIX_BASE_URL = "https://trackapi.nutritionix.com/v2";
const DEFAULT_TIMEOUT_MS = 3500;
const MAX_ENRICHED_SUGGESTIONS = 5;

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function asCleanString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function roundMacro(value: number | undefined) {
  return Math.round((value ?? 0) * 10) / 10;
}

function roundCalories(value: number | undefined) {
  return Math.round(value ?? 0);
}

function buildServingLabel(food: NutritionixNutrientsFood | NutritionixInstantSuggestion) {
  const servingQty = asFiniteNumber(food.serving_qty);
  const servingUnit = asCleanString(food.serving_unit);
  const servingGrams = asFiniteNumber(food.serving_weight_grams);

  if (servingQty && servingUnit) return `${servingQty} ${servingUnit}`;
  if (servingUnit) return `1 ${servingUnit}`;
  if (servingGrams) return `${Math.round(servingGrams)}g`;
  return "1 serving";
}

function buildPortionOptions(
  food: NutritionixNutrientsFood | NutritionixInstantSuggestion,
): FoodPortionOption[] {
  const servingGrams = asFiniteNumber(food.serving_weight_grams);
  const servingLabel = buildServingLabel(food);
  return [
    { label: servingLabel, ...(servingGrams ? { grams: Math.round(servingGrams) } : {}) },
    ...(servingGrams && Math.round(servingGrams) !== 100 ? [{ label: "100g", grams: 100 }] : []),
  ];
}

function nutritionixFoodToSearchItem(
  food: NutritionixNutrientsFood | NutritionixInstantSuggestion,
  fallbackId: string,
): ProviderFoodSearchItem | null {
  const name = asCleanString(food.food_name);
  if (!name) return null;

  const servingGrams = asFiniteNumber(food.serving_weight_grams);
  const calories = roundCalories(asFiniteNumber(food.nf_calories));
  const protein = roundMacro(asFiniteNumber((food as NutritionixNutrientsFood).nf_protein));
  const carbs = roundMacro(
    asFiniteNumber((food as NutritionixNutrientsFood).nf_total_carbohydrate),
  );
  const fat = roundMacro(asFiniteNumber((food as NutritionixNutrientsFood).nf_total_fat));
  const hasMacroData = Boolean(calories || protein || carbs || fat);
  const itemId = asCleanString(food.nix_item_id);
  const tagId = asCleanString((food as NutritionixNutrientsFood).tag_id);
  const sourceProductId = itemId ?? tagId ?? `nutritionix-${normalizeKey(`${name}-${fallbackId}`)}`;

  return {
    id: `nutritionix-${sourceProductId}`,
    source: "nutritionix" as FoodCatalogSource,
    sourceProductId,
    name,
    ...(asCleanString(food.brand_name) ? { brand: asCleanString(food.brand_name) } : {}),
    servingLabel: buildServingLabel(food),
    ...(servingGrams ? { servingGrams: Math.round(servingGrams) } : {}),
    calories,
    protein,
    carbs,
    fat,
    fiber: roundMacro(asFiniteNumber((food as NutritionixNutrientsFood).nf_dietary_fiber)),
    sugar: roundMacro(asFiniteNumber((food as NutritionixNutrientsFood).nf_sugars)),
    sodiumMg: roundMacro(asFiniteNumber((food as NutritionixNutrientsFood).nf_sodium)),
    ingredients: [],
    allergens: [],
    portionOptions: buildPortionOptions(food),
    confidence: hasMacroData ? "high" : "low",
    provenance: {
      provider: "nutritionix",
      cached: false,
      qualityScore: hasMacroData ? 78 : 35,
    },
  };
}

function getNutritionixConfig(): NutritionixConfig | null {
  const appId = process.env.NUTRITIONIX_APP_ID?.trim();
  const apiKey = process.env.NUTRITIONIX_API_KEY?.trim();
  if (!appId || !apiKey) return null;

  const timeoutMs = asFiniteNumber(process.env.NUTRITIONIX_TIMEOUT_MS) ?? DEFAULT_TIMEOUT_MS;
  return {
    appId,
    apiKey,
    remoteUserId: process.env.NUTRITIONIX_REMOTE_USER_ID?.trim() || "0",
    timeoutMs: Math.max(1000, Math.min(10000, Math.round(timeoutMs))),
  };
}

async function nutritionixFetch<TPayload>(
  path: string,
  config: NutritionixConfig,
  init: RequestInit = {},
): Promise<TPayload | null> {
  const response = await fetch(`${NUTRITIONIX_BASE_URL}${path}`, {
    ...init,
    signal: AbortSignal.timeout(config.timeoutMs),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "x-app-id": config.appId,
      "x-app-key": config.apiKey,
      "x-remote-user-id": config.remoteUserId,
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) return null;
  return (await response.json()) as TPayload;
}

function uniqueSuggestions(payload: NutritionixInstantResponse, limit: number) {
  const seen = new Set<string>();
  const suggestions: NutritionixSuggestion[] = [];
  const addSuggestion = (
    kind: NutritionixSuggestion["kind"],
    entry: NutritionixInstantSuggestion,
  ) => {
    const name = asCleanString(entry.food_name);
    if (!name) return;
    const itemId = asCleanString(entry.nix_item_id);
    const tagId = asCleanString(entry.tag_id);
    const brand = asCleanString(entry.brand_name);
    const key = itemId ?? `${kind}:${normalizeKey(`${brand ?? ""}-${name}`)}`;
    if (seen.has(key)) return;
    seen.add(key);
    suggestions.push({
      kind,
      name,
      ...(brand ? { brand } : {}),
      ...(itemId ? { itemId } : {}),
      ...(tagId ? { tagId } : {}),
    });
  };

  for (const entry of payload.common ?? []) addSuggestion("common", entry);
  for (const entry of payload.branded ?? []) addSuggestion("branded", entry);
  return suggestions.slice(0, Math.max(1, Math.min(limit, MAX_ENRICHED_SUGGESTIONS)));
}

async function lookupNutritionixItem(
  suggestion: NutritionixSuggestion,
  config: NutritionixConfig,
): Promise<ProviderFoodSearchItem | null> {
  if (suggestion.kind === "branded" && suggestion.itemId) {
    const payload = await nutritionixFetch<NutritionixFoodResponse>(
      `/search/item?nix_item_id=${encodeURIComponent(suggestion.itemId)}`,
      config,
    );
    const [food] = payload?.foods ?? [];
    if (food) return nutritionixFoodToSearchItem(food, suggestion.itemId);
  }

  const payload = await nutritionixFetch<NutritionixFoodResponse>("/natural/nutrients", config, {
    method: "POST",
    body: JSON.stringify({ query: suggestion.name }),
  });
  const [food] = payload?.foods ?? [];
  return food ? nutritionixFoodToSearchItem(food, suggestion.tagId ?? suggestion.name) : null;
}

function dedupeNutritionixItems(items: ProviderFoodSearchItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.sourceProductId ?? normalizeKey(`${item.brand ?? ""}-${item.name}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function searchNutritionixFoods(
  query: string,
  limit: number,
): Promise<NutritionixSearchOutcome> {
  const cleanedQuery = query.trim();
  if (cleanedQuery.length < 2 || limit <= 0) return { items: [], status: "skipped" };

  const config = getNutritionixConfig();
  if (!config) return { items: [], status: "not_configured" };

  try {
    const instantPayload = await nutritionixFetch<NutritionixInstantResponse>(
      `/search/instant?query=${encodeURIComponent(cleanedQuery)}`,
      config,
    );
    if (!instantPayload) return { items: [], status: "provider_error" };

    const suggestions = uniqueSuggestions(instantPayload, limit);
    const enrichedItems: ProviderFoodSearchItem[] = [];
    for (const suggestion of suggestions) {
      const item = await lookupNutritionixItem(suggestion, config);
      if (item) enrichedItems.push(item);
    }

    if (enrichedItems.length === 0) {
      const directPayload = await nutritionixFetch<NutritionixFoodResponse>(
        "/natural/nutrients",
        config,
        {
          method: "POST",
          body: JSON.stringify({ query: cleanedQuery }),
        },
      );
      const directItems = (directPayload?.foods ?? [])
        .map((food, index) => nutritionixFoodToSearchItem(food, `${cleanedQuery}-${index}`))
        .filter((item): item is ProviderFoodSearchItem => item !== null);
      enrichedItems.push(...directItems);
    }

    const items = dedupeNutritionixItems(enrichedItems).slice(0, limit);
    return { items, status: items.length > 0 ? "hit" : "miss" };
  } catch {
    return { items: [], status: "provider_error" };
  }
}
