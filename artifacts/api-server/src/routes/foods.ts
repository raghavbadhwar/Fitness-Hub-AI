import { createHash, randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import {
  db,
  foodCatalogItems,
  foodLookupEvents,
  memberFoodItems,
  type FoodCatalogItem,
  type FoodCatalogSource,
  type FoodMicronutrients,
  type FoodPortionOption,
  type MemberFoodItem,
} from "@workspace/db";
import { requireApiAuth } from "../middlewares/apiAuth.ts";
import { requireApprovedAccess } from "../lib/user-access.ts";
import { searchCuratedGlobalFoods } from "../lib/curated-global-food-search.ts";
import {
  searchNutritionixFoods,
  type NutritionixSearchStatus,
} from "../lib/nutritionix-food-provider.ts";
import { readObjectBody } from "../lib/request-validation.ts";

const router = Router();
const BARCODE_RE = /^[0-9]{6,14}$/;
const MAX_SEARCH_LIMIT = 20;
const OPEN_FOOD_FACTS_TIMEOUT_MS = 3500;

router.use(requireApiAuth);

interface FoodSearchItem {
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

interface ProviderFood {
  source: FoodCatalogSource;
  sourceProductId: string;
  barcode?: string;
  name: string;
  brand?: string;
  foodCategory?: string;
  defaultServingLabel?: string;
  defaultServingGrams?: number;
  caloriesPer100g?: number;
  proteinPer100g?: number;
  carbsPer100g?: number;
  fatPer100g?: number;
  fiberPer100g?: number;
  sugarPer100g?: number;
  sodiumMgPer100g?: number;
  ingredients: string[];
  allergens: string[];
  portionOptions: FoodPortionOption[];
  rawProviderPayload?: unknown;
  qualityScore: number;
}

type FreeProviderSearchStatus = "hit" | "miss" | "provider_error" | "skipped";

function clampLimit(rawValue: unknown) {
  const parsed = typeof rawValue === "string" ? Number(rawValue) : null;
  return typeof parsed === "number" && Number.isFinite(parsed)
    ? Math.max(1, Math.min(MAX_SEARCH_LIMIT, Math.round(parsed)))
    : 10;
}

function firstQueryValue(value: unknown): string | undefined {
  if (Array.isArray(value)) return firstQueryValue(value[0]);
  return typeof value === "string" ? value.trim() : undefined;
}

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter(
      (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
    );
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function asMicronutrients(value: unknown): FoodMicronutrients {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string | number | null] => {
      const [, entryValue] = entry;
      return (
        typeof entryValue === "string" || typeof entryValue === "number" || entryValue === null
      );
    }),
  );
}

function asPortionOptions(value: unknown): FoodPortionOption[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const record = entry as Record<string, unknown>;
      const label = typeof record.label === "string" ? record.label.trim() : "";
      if (!label) return null;
      const grams = asFiniteNumber(record.grams);
      const milliliters = asFiniteNumber(record.milliliters);
      const aliases = asStringArray(record.aliases);
      return {
        label,
        ...(typeof grams === "number" ? { grams } : {}),
        ...(typeof milliliters === "number" ? { milliliters } : {}),
        ...(aliases.length > 0 ? { aliases } : {}),
        ...(typeof record.region === "string" && record.region.trim()
          ? { region: record.region.trim() }
          : {}),
      };
    })
    .filter((entry): entry is FoodPortionOption => entry !== null);
}

function valuePerServing(per100g: number | null | undefined, grams: number | null | undefined) {
  if (typeof per100g !== "number") return 0;
  const servingGrams = typeof grams === "number" && grams > 0 ? grams : 100;
  return Math.round((per100g * servingGrams) / 100);
}

function macroPerServing(per100g: number | null | undefined, grams: number | null | undefined) {
  if (typeof per100g !== "number") return 0;
  const servingGrams = typeof grams === "number" && grams > 0 ? grams : 100;
  return Math.round(((per100g * servingGrams) / 100) * 10) / 10;
}

function serializeCatalogFood(row: FoodCatalogItem, cached: boolean): FoodSearchItem {
  const servingGrams = row.defaultServingGrams ?? 100;
  return {
    id: row.id,
    source: row.source,
    ...(row.sourceProductId ? { sourceProductId: row.sourceProductId } : {}),
    catalogItemId: row.id,
    ...(row.barcode ? { barcode: row.barcode } : {}),
    name: row.name,
    ...(row.brand ? { brand: row.brand } : {}),
    servingLabel: row.defaultServingLabel ?? `${servingGrams}g`,
    servingGrams,
    calories: valuePerServing(row.caloriesPer100g, servingGrams),
    protein: macroPerServing(row.proteinPer100g, servingGrams),
    carbs: macroPerServing(row.carbsPer100g, servingGrams),
    fat: macroPerServing(row.fatPer100g, servingGrams),
    fiber: macroPerServing(row.fiberPer100g, servingGrams),
    sugar: macroPerServing(row.sugarPer100g, servingGrams),
    sodiumMg: macroPerServing(row.sodiumMgPer100g, servingGrams),
    ingredients: row.ingredients,
    allergens: row.allergens,
    portionOptions: row.portionOptions,
    confidence: row.qualityScore >= 70 ? "high" : row.qualityScore >= 40 ? "medium" : "low",
    provenance: { provider: row.source, cached, qualityScore: row.qualityScore },
  };
}

function serializeMemberFood(row: MemberFoodItem): FoodSearchItem {
  return {
    id: row.id,
    source: "member_custom",
    memberFoodItemId: row.id,
    ...(row.catalogItemId ? { catalogItemId: row.catalogItemId } : {}),
    name: row.name,
    ...(row.brand ? { brand: row.brand } : {}),
    servingLabel: row.servingLabel,
    ...(row.servingGrams ? { servingGrams: row.servingGrams } : {}),
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
    fiber: row.fiber,
    ingredients: [],
    allergens: [],
    portionOptions: row.portionOptions,
    confidence: row.confidence === "high" || row.confidence === "low" ? row.confidence : "medium",
    provenance: { provider: row.source, cached: true },
  };
}

function providerFoodToCatalogValues(food: ProviderFood) {
  return {
    id: randomUUID(),
    source: food.source,
    sourceProductId: food.sourceProductId,
    barcode: food.barcode ?? null,
    name: food.name,
    brand: food.brand ?? null,
    foodCategory: food.foodCategory ?? null,
    defaultServingLabel: food.defaultServingLabel ?? null,
    defaultServingGrams: food.defaultServingGrams ?? null,
    caloriesPer100g: food.caloriesPer100g ? Math.round(food.caloriesPer100g) : null,
    proteinPer100g: food.proteinPer100g ?? null,
    carbsPer100g: food.carbsPer100g ?? null,
    fatPer100g: food.fatPer100g ?? null,
    fiberPer100g: food.fiberPer100g ?? null,
    sugarPer100g: food.sugarPer100g ?? null,
    sodiumMgPer100g: food.sodiumMgPer100g ?? null,
    ingredients: food.ingredients,
    allergens: food.allergens,
    portionOptions: food.portionOptions,
    rawProviderPayload: food.rawProviderPayload ?? null,
    qualityScore: food.qualityScore,
  };
}

function providerFoodToSearchItem(food: ProviderFood, provider: string): FoodSearchItem {
  const servingGrams = food.defaultServingGrams ?? 100;
  return {
    id: `${food.source}-${food.sourceProductId}`,
    source: food.source,
    sourceProductId: food.sourceProductId,
    ...(food.barcode ? { barcode: food.barcode } : {}),
    name: food.name,
    ...(food.brand ? { brand: food.brand } : {}),
    servingLabel: food.defaultServingLabel ?? `${servingGrams}g`,
    servingGrams,
    calories: valuePerServing(food.caloriesPer100g, servingGrams),
    protein: macroPerServing(food.proteinPer100g, servingGrams),
    carbs: macroPerServing(food.carbsPer100g, servingGrams),
    fat: macroPerServing(food.fatPer100g, servingGrams),
    fiber: macroPerServing(food.fiberPer100g, servingGrams),
    sugar: macroPerServing(food.sugarPer100g, servingGrams),
    sodiumMg: macroPerServing(food.sodiumMgPer100g, servingGrams),
    ingredients: food.ingredients,
    allergens: food.allergens,
    portionOptions: food.portionOptions,
    confidence: food.qualityScore >= 70 ? "high" : food.qualityScore >= 40 ? "medium" : "low",
    provenance: { provider, cached: false, qualityScore: food.qualityScore },
  };
}

function hashInput(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function recordFoodLookupEvent(args: {
  gymId: string;
  memberClerkId: string;
  lookupType: string;
  input?: string;
  barcode?: string;
  provider?: string;
  status: string;
  confidence?: string;
  selectedCatalogItemId?: string;
  latencyMs?: number;
  errorCode?: string;
}) {
  try {
    await db.insert(foodLookupEvents).values({
      id: randomUUID(),
      gymId: args.gymId,
      memberClerkId: args.memberClerkId,
      lookupType: args.lookupType,
      inputHash: args.input ? hashInput(args.input) : null,
      barcode: args.barcode ?? null,
      provider: args.provider ?? null,
      status: args.status,
      confidence: args.confidence ?? null,
      selectedCatalogItemId: args.selectedCatalogItemId ?? null,
      latencyMs: args.latencyMs ?? null,
      errorCode: args.errorCode ?? null,
    });
  } catch {
    // Lookup telemetry must not block the user from logging food.
  }
}

function openFoodFactsProductToProviderFood(
  product: Record<string, unknown>,
  fallbackProductId: string,
) {
  const nutriments =
    product.nutriments && typeof product.nutriments === "object"
      ? (product.nutriments as Record<string, unknown>)
      : {};
  const name =
    typeof product.product_name === "string" && product.product_name.trim()
      ? product.product_name.trim()
      : "";
  if (!name) return null;

  const servingQuantity = asFiniteNumber(product.serving_quantity);
  const sodiumPer100g = asFiniteNumber(nutriments["sodium_100g"]);
  const caloriesPer100g = asFiniteNumber(nutriments["energy-kcal_100g"]);
  const proteinPer100g = asFiniteNumber(nutriments["proteins_100g"]);
  const carbsPer100g = asFiniteNumber(nutriments["carbohydrates_100g"]);
  const fatPer100g = asFiniteNumber(nutriments["fat_100g"]);
  const fiberPer100g = asFiniteNumber(nutriments["fiber_100g"]);
  const sugarPer100g = asFiniteNumber(nutriments["sugars_100g"]);
  const servingSize =
    typeof product.serving_size === "string" && product.serving_size.trim()
      ? product.serving_size.trim()
      : undefined;
  const ingredientsText =
    typeof product.ingredients_text === "string" ? product.ingredients_text : "";

  const providerFood: ProviderFood = {
    source: "open_food_facts",
    sourceProductId:
      typeof product.code === "string" && product.code.trim()
        ? product.code.trim()
        : fallbackProductId,
    ...(typeof product.code === "string" && product.code.trim()
      ? { barcode: product.code.trim() }
      : {}),
    name,
    ...(typeof product.brands === "string" && product.brands.trim()
      ? { brand: product.brands.trim().split(",")[0]?.trim() }
      : {}),
    ...(typeof product.categories === "string" && product.categories.trim()
      ? { foodCategory: product.categories.trim().split(",")[0]?.trim() }
      : {}),
    defaultServingLabel: servingSize ?? (servingQuantity ? `${servingQuantity}g` : "100g"),
    defaultServingGrams: servingQuantity,
    caloriesPer100g,
    proteinPer100g,
    carbsPer100g,
    fatPer100g,
    fiberPer100g,
    sugarPer100g,
    sodiumMgPer100g:
      typeof sodiumPer100g === "number" ? Math.round(sodiumPer100g * 1000) : undefined,
    ingredients: ingredientsText
      .split(",")
      .map((ingredient) => ingredient.trim())
      .filter(Boolean)
      .slice(0, 20),
    allergens: asStringArray(product.allergens_tags),
    portionOptions: [
      ...(servingSize || servingQuantity
        ? [{ label: servingSize ?? `${servingQuantity}g`, grams: servingQuantity ?? 100 }]
        : []),
      { label: "100g", grams: 100 },
    ],
    rawProviderPayload: product,
    qualityScore:
      typeof caloriesPer100g === "number" && typeof proteinPer100g === "number" ? 80 : 45,
  };

  return providerFood;
}

async function lookupOpenFoodFactsByBarcode(barcode: string): Promise<ProviderFood | null> {
  const fields = [
    "code",
    "product_name",
    "brands",
    "categories",
    "nutriments",
    "ingredients_text",
    "allergens_tags",
    "serving_size",
    "serving_quantity",
  ].join(",");
  const response = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
      barcode,
    )}.json?fields=${encodeURIComponent(fields)}`,
    { headers: { Accept: "application/json" } },
  );
  if (!response.ok) return null;
  const payload = (await response.json()) as Record<string, unknown>;
  if (payload.status !== 1 || !payload.product || typeof payload.product !== "object") {
    return null;
  }
  return openFoodFactsProductToProviderFood(payload.product as Record<string, unknown>, barcode);
}

async function searchOpenFoodFactsFoods(
  query: string,
  limit: number,
): Promise<{ items: FoodSearchItem[]; status: FreeProviderSearchStatus }> {
  const cleanedQuery = query.trim();
  if (cleanedQuery.length < 2 || limit <= 0) return { items: [], status: "skipped" };

  const fields = [
    "code",
    "product_name",
    "brands",
    "categories",
    "nutriments",
    "ingredients_text",
    "allergens_tags",
    "serving_size",
    "serving_quantity",
  ].join(",");
  const url = new URL("https://world.openfoodfacts.org/cgi/search.pl");
  url.searchParams.set("search_terms", cleanedQuery);
  url.searchParams.set("search_simple", "1");
  url.searchParams.set("action", "process");
  url.searchParams.set("json", "1");
  url.searchParams.set("page_size", String(Math.min(limit, 10)));
  url.searchParams.set("fields", fields);

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(OPEN_FOOD_FACTS_TIMEOUT_MS),
      headers: {
        Accept: "application/json",
        "User-Agent": "FitnessHubAI/0.1 food-search",
      },
    });
    if (!response.ok) return { items: [], status: "provider_error" };

    const payload = (await response.json()) as { products?: Array<Record<string, unknown>> };
    const products = Array.isArray(payload.products) ? payload.products : [];
    const items = products
      .flatMap((product, index) => {
        const providerFood = openFoodFactsProductToProviderFood(
          product,
          `search-${normalizeResultKey(`${cleanedQuery}-${index}`)}`,
        );
        return providerFood
          ? [providerFoodToSearchItem(providerFood, "open_food_facts_search")]
          : [];
      })
      .slice(0, limit);
    return { items, status: items.length > 0 ? "hit" : "miss" };
  } catch {
    return { items: [], status: "provider_error" };
  }
}

async function searchUsdaFoods(query: string, limit: number): Promise<FoodSearchItem[]> {
  const apiKey = process.env.FOODDATA_CENTRAL_API_KEY?.trim();
  if (!apiKey || query.length < 2) return [];

  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  url.searchParams.set("query", query);
  url.searchParams.set("pageSize", String(Math.min(limit, 10)));
  url.searchParams.set("api_key", apiKey);

  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) return [];

  const payload = (await response.json()) as { foods?: Array<Record<string, unknown>> };
  return (payload.foods ?? []).flatMap((food) => {
    const nutrients = Array.isArray(food.foodNutrients) ? food.foodNutrients : [];
    const nutrientByName = new Map(
      nutrients
        .filter((entry): entry is Record<string, unknown> =>
          Boolean(entry && typeof entry === "object"),
        )
        .map((entry) => [String(entry.nutrientName ?? "").toLowerCase(), entry]),
    );
    const nutrientValue = (name: string) =>
      asFiniteNumber(nutrientByName.get(name.toLowerCase())?.value) ?? 0;
    const name = typeof food.description === "string" ? food.description.trim() : "";
    if (!name) return [];
    return [
      {
        id: `usda-${String(food.fdcId ?? name)}`,
        source: "usda" as const,
        sourceProductId: String(food.fdcId ?? name),
        name,
        ...(typeof food.brandOwner === "string" && food.brandOwner.trim()
          ? { brand: food.brandOwner.trim() }
          : {}),
        servingLabel: "100g",
        servingGrams: 100,
        calories: Math.round(nutrientValue("energy")),
        protein: nutrientValue("protein"),
        carbs: nutrientValue("carbohydrate, by difference"),
        fat: nutrientValue("total lipid (fat)"),
        fiber: nutrientValue("fiber, total dietary"),
        ingredients: [],
        allergens: [],
        portionOptions: [{ label: "100g", grams: 100 }],
        confidence: "medium" as const,
        provenance: { provider: "usda_fooddata_central", cached: false, qualityScore: 65 },
      },
    ];
  });
}

function normalizeResultKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function dedupeSearchResults(items: FoodSearchItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const identityKey =
      item.catalogItemId ??
      item.memberFoodItemId ??
      item.sourceProductId ??
      `${item.source}:${normalizeResultKey(item.name)}`;
    const nameKey = normalizeResultKey(item.name);
    const keys = [identityKey, `name:${nameKey}`];
    if (keys.some((key) => seen.has(key))) return false;
    keys.forEach((key) => seen.add(key));
    return true;
  });
}

function providerLabel(args: {
  localCount: number;
  nutritionixStatus: NutritionixSearchStatus;
  nutritionixCount: number;
  openFoodFactsStatus: FreeProviderSearchStatus;
  openFoodFactsCount: number;
  curatedCount: number;
  usdaCount: number;
}) {
  const providers = ["local"];
  if (args.nutritionixCount > 0) providers.push("nutritionix");
  if (args.openFoodFactsCount > 0) providers.push("open_food_facts");
  if (args.usdaCount > 0) providers.push("usda");
  if (args.curatedCount > 0) providers.push("curated");
  if (args.nutritionixStatus === "provider_error") providers.push("nutritionix_error");
  if (args.nutritionixStatus === "not_configured") providers.push("nutritionix_not_configured");
  if (args.nutritionixStatus === "skipped") providers.push("paid_provider_disabled");
  if (args.openFoodFactsStatus === "provider_error") providers.push("open_food_facts_error");
  return args.localCount || providers.length > 1 ? `mixed_${providers.join("_")}` : "local";
}

function paidFoodProvidersEnabled() {
  return process.env.FOOD_SEARCH_ENABLE_PAID_PROVIDERS?.trim().toLowerCase() === "true";
}

async function requireFoodAccess(req: Request, res: Response) {
  return requireApprovedAccess(req, res, ["member", "trainer", "owner"]);
}

router.get("/search", async (req: Request, res: Response) => {
  const startedAt = Date.now();
  try {
    const access = await requireFoodAccess(req, res);
    if (!access) return;

    const query = firstQueryValue(req.query.q) ?? "";
    const limit = clampLimit(firstQueryValue(req.query.limit));
    const likeQuery = `%${query}%`;

    const memberRows = query
      ? await db
          .select()
          .from(memberFoodItems)
          .where(
            and(
              eq(memberFoodItems.gymId, access.gymId),
              eq(memberFoodItems.memberClerkId, access.userId),
              ilike(memberFoodItems.name, likeQuery),
            ),
          )
          .orderBy(desc(memberFoodItems.updatedAt))
          .limit(limit)
      : await db
          .select()
          .from(memberFoodItems)
          .where(
            and(
              eq(memberFoodItems.gymId, access.gymId),
              eq(memberFoodItems.memberClerkId, access.userId),
            ),
          )
          .orderBy(desc(memberFoodItems.updatedAt))
          .limit(limit);

    const catalogRows = query
      ? await db
          .select()
          .from(foodCatalogItems)
          .where(
            or(ilike(foodCatalogItems.name, likeQuery), ilike(foodCatalogItems.brand, likeQuery)),
          )
          .orderBy(desc(foodCatalogItems.qualityScore))
          .limit(Math.max(0, limit - memberRows.length))
      : [];

    const localResults = [
      ...memberRows.map(serializeMemberFood),
      ...catalogRows.map((row) => serializeCatalogFood(row, true)),
    ];
    const paidProvidersEnabled = paidFoodProvidersEnabled();
    const nutritionixOutcome =
      query && paidProvidersEnabled
        ? await searchNutritionixFoods(query, Math.max(0, limit - localResults.length))
        : { items: [], status: "skipped" as const };
    const openFoodFactsOutcome =
      query && localResults.length + nutritionixOutcome.items.length < limit
        ? await searchOpenFoodFactsFoods(
            query,
            limit - localResults.length - nutritionixOutcome.items.length,
          )
        : { items: [], status: "skipped" as const };
    const usdaResults =
      localResults.length + nutritionixOutcome.items.length + openFoodFactsOutcome.items.length <
      limit
        ? await searchUsdaFoods(
            query,
            limit -
              localResults.length -
              nutritionixOutcome.items.length -
              openFoodFactsOutcome.items.length,
          )
        : [];
    const curatedResults =
      localResults.length +
        nutritionixOutcome.items.length +
        openFoodFactsOutcome.items.length +
        usdaResults.length <
      limit
        ? searchCuratedGlobalFoods(
            query,
            limit -
              localResults.length -
              nutritionixOutcome.items.length -
              openFoodFactsOutcome.items.length -
              usdaResults.length,
          )
        : [];
    const results = dedupeSearchResults([
      ...localResults,
      ...nutritionixOutcome.items,
      ...openFoodFactsOutcome.items,
      ...usdaResults,
      ...curatedResults,
    ]).slice(0, limit);

    await recordFoodLookupEvent({
      gymId: access.gymId,
      memberClerkId: access.userId,
      lookupType: "search",
      input: query,
      provider: providerLabel({
        localCount: localResults.length,
        nutritionixStatus: nutritionixOutcome.status,
        nutritionixCount: nutritionixOutcome.items.length,
        openFoodFactsStatus: openFoodFactsOutcome.status,
        openFoodFactsCount: openFoodFactsOutcome.items.length,
        curatedCount: curatedResults.length,
        usdaCount: usdaResults.length,
      }),
      status: "success",
      latencyMs: Date.now() - startedAt,
    });

    res.json({
      items: results,
      fallbackUsed:
        openFoodFactsOutcome.status === "provider_error"
          ? "open_food_facts_provider_error"
          : nutritionixOutcome.status === "provider_error"
            ? "nutritionix_provider_error"
            : results.length
              ? null
              : "manual",
    });
  } catch (err) {
    req.log.error({ err }, "Failed to search foods");
    res.status(500).json({ error: "Failed to search foods" });
  }
});

router.get("/barcode/:barcode", async (req: Request, res: Response) => {
  const startedAt = Date.now();
  try {
    const access = await requireFoodAccess(req, res);
    if (!access) return;

    const barcode = Array.isArray(req.params.barcode) ? req.params.barcode[0] : req.params.barcode;
    if (!barcode || !BARCODE_RE.test(barcode)) {
      res.status(400).json({ error: "barcode must be 6-14 digits" });
      return;
    }

    const [cached] = await db
      .select()
      .from(foodCatalogItems)
      .where(eq(foodCatalogItems.barcode, barcode))
      .limit(1);
    if (cached) {
      await recordFoodLookupEvent({
        gymId: access.gymId,
        memberClerkId: access.userId,
        lookupType: "barcode",
        barcode,
        provider: cached.source,
        status: "cache_hit",
        confidence: cached.qualityScore >= 70 ? "high" : "medium",
        selectedCatalogItemId: cached.id,
        latencyMs: Date.now() - startedAt,
      });
      res.json({ item: serializeCatalogFood(cached, true), fallbackUsed: null });
      return;
    }

    const providerFood = await lookupOpenFoodFactsByBarcode(barcode);
    if (!providerFood) {
      await recordFoodLookupEvent({
        gymId: access.gymId,
        memberClerkId: access.userId,
        lookupType: "barcode",
        barcode,
        provider: "open_food_facts",
        status: "not_found",
        latencyMs: Date.now() - startedAt,
      });
      res.status(404).json({ error: "Food barcode not found", fallbackUsed: "manual_or_label" });
      return;
    }

    const [row] = await db
      .insert(foodCatalogItems)
      .values(providerFoodToCatalogValues(providerFood))
      .onConflictDoUpdate({
        target: [foodCatalogItems.source, foodCatalogItems.sourceProductId],
        set: {
          barcode: providerFood.barcode ?? null,
          name: providerFood.name,
          brand: providerFood.brand ?? null,
          foodCategory: providerFood.foodCategory ?? null,
          defaultServingLabel: providerFood.defaultServingLabel ?? null,
          defaultServingGrams: providerFood.defaultServingGrams ?? null,
          caloriesPer100g: providerFood.caloriesPer100g
            ? Math.round(providerFood.caloriesPer100g)
            : null,
          proteinPer100g: providerFood.proteinPer100g ?? null,
          carbsPer100g: providerFood.carbsPer100g ?? null,
          fatPer100g: providerFood.fatPer100g ?? null,
          fiberPer100g: providerFood.fiberPer100g ?? null,
          sugarPer100g: providerFood.sugarPer100g ?? null,
          sodiumMgPer100g: providerFood.sodiumMgPer100g ?? null,
          ingredients: providerFood.ingredients,
          allergens: providerFood.allergens,
          portionOptions: providerFood.portionOptions,
          rawProviderPayload: providerFood.rawProviderPayload ?? null,
          qualityScore: providerFood.qualityScore,
          updatedAt: new Date(),
        },
      })
      .returning();

    await recordFoodLookupEvent({
      gymId: access.gymId,
      memberClerkId: access.userId,
      lookupType: "barcode",
      barcode,
      provider: "open_food_facts",
      status: "provider_hit",
      confidence: row.qualityScore >= 70 ? "high" : "medium",
      selectedCatalogItemId: row.id,
      latencyMs: Date.now() - startedAt,
    });

    res.json({ item: serializeCatalogFood(row, false), fallbackUsed: null });
  } catch (err) {
    req.log.error({ err }, "Failed to look up food barcode");
    res.status(500).json({ error: "Failed to look up food barcode", fallbackUsed: "manual" });
  }
});

router.post("/custom", async (req: Request, res: Response) => {
  try {
    const access = await requireFoodAccess(req, res);
    if (!access) return;

    const body = readObjectBody(req.body, res);
    if (!body) return;

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const servingLabel =
      typeof body.servingLabel === "string" && body.servingLabel.trim()
        ? body.servingLabel.trim()
        : "1 serving";
    const calories = asFiniteNumber(body.calories);
    const protein = asFiniteNumber(body.protein);
    const carbs = asFiniteNumber(body.carbs);
    const fat = asFiniteNumber(body.fat);
    const fiber = asFiniteNumber(body.fiber) ?? 0;
    if (
      !name ||
      calories === undefined ||
      protein === undefined ||
      carbs === undefined ||
      fat === undefined ||
      calories < 0 ||
      protein < 0 ||
      carbs < 0 ||
      fat < 0 ||
      fiber < 0
    ) {
      res.status(400).json({ error: "name and finite non-negative macros are required" });
      return;
    }

    const confidence: "high" | "medium" | "low" =
      body.confidence === "high" || body.confidence === "low" || body.confidence === "medium"
        ? body.confidence
        : "medium";
    const source =
      typeof body.source === "string" && body.source.trim() ? body.source.trim() : "manual";
    const servingGrams = asFiniteNumber(body.servingGrams);
    const now = new Date();
    const [row] = await db
      .insert(memberFoodItems)
      .values({
        id: randomUUID(),
        gymId: access.gymId,
        memberClerkId: access.userId,
        catalogItemId:
          typeof body.catalogItemId === "string" && body.catalogItemId.trim()
            ? body.catalogItemId.trim()
            : null,
        name,
        brand: typeof body.brand === "string" && body.brand.trim() ? body.brand.trim() : null,
        servingLabel,
        servingGrams: typeof servingGrams === "number" ? Math.round(servingGrams) : null,
        calories: Math.round(calories),
        protein,
        carbs,
        fat,
        fiber,
        micronutrients: asMicronutrients(body.micronutrients),
        portionOptions: asPortionOptions(body.portionOptions),
        source,
        confidence,
        isFavorite: Boolean(body.isFavorite),
        lastLoggedAt: now,
      })
      .returning();

    res.status(201).json({ item: serializeMemberFood(row) });
  } catch (err) {
    req.log.error({ err }, "Failed to save custom food");
    res.status(500).json({ error: "Failed to save custom food" });
  }
});

export default router;
