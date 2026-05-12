import {
  boolean,
  doublePrecision,
  integer,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export type FoodCatalogSource =
  | "open_food_facts"
  | "usda"
  | "nutritionix"
  | "curated"
  | "user"
  | "ai_label";

export interface FoodPortionOption {
  label: string;
  grams?: number;
  milliliters?: number;
  aliases?: string[];
  region?: string;
}

export interface FoodMicronutrients {
  [name: string]: number | string | null;
}

export const foodCatalogItems = pgTable(
  "food_catalog_items",
  {
    id: text("id").primaryKey(),
    source: text("source").notNull().$type<FoodCatalogSource>(),
    sourceProductId: text("source_product_id"),
    barcode: text("barcode"),
    name: text("name").notNull(),
    brand: text("brand"),
    foodCategory: text("food_category"),
    defaultServingLabel: text("default_serving_label"),
    defaultServingGrams: integer("default_serving_grams"),
    caloriesPer100g: integer("calories_per_100g"),
    proteinPer100g: doublePrecision("protein_per_100g"),
    carbsPer100g: doublePrecision("carbs_per_100g"),
    fatPer100g: doublePrecision("fat_per_100g"),
    fiberPer100g: doublePrecision("fiber_per_100g"),
    sugarPer100g: doublePrecision("sugar_per_100g"),
    sodiumMgPer100g: doublePrecision("sodium_mg_per_100g"),
    micronutrients: jsonb("micronutrients").notNull().default({}).$type<FoodMicronutrients>(),
    ingredients: jsonb("ingredients").notNull().default([]).$type<string[]>(),
    allergens: jsonb("allergens").notNull().default([]).$type<string[]>(),
    portionOptions: jsonb("portion_options").notNull().default([]).$type<FoodPortionOption[]>(),
    rawProviderPayload: jsonb("raw_provider_payload"),
    qualityScore: integer("quality_score").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("food_catalog_items_source_product_idx").on(table.source, table.sourceProductId),
    index("food_catalog_items_barcode_idx").on(table.barcode),
    index("food_catalog_items_name_idx").on(table.name),
    index("food_catalog_items_category_idx").on(table.foodCategory),
  ],
);

export const memberFoodItems = pgTable(
  "member_food_items",
  {
    id: text("id").primaryKey(),
    gymId: text("gym_id").notNull().default("gymos-main"),
    memberClerkId: text("member_clerk_id").notNull(),
    catalogItemId: text("catalog_item_id"),
    name: text("name").notNull(),
    brand: text("brand"),
    servingLabel: text("serving_label").notNull(),
    servingGrams: integer("serving_grams"),
    calories: integer("calories").notNull(),
    protein: doublePrecision("protein").notNull(),
    carbs: doublePrecision("carbs").notNull(),
    fat: doublePrecision("fat").notNull(),
    fiber: doublePrecision("fiber").notNull().default(0),
    micronutrients: jsonb("micronutrients").notNull().default({}).$type<FoodMicronutrients>(),
    portionOptions: jsonb("portion_options").notNull().default([]).$type<FoodPortionOption[]>(),
    source: text("source").notNull(),
    confidence: text("confidence").notNull().default("medium"),
    isFavorite: boolean("is_favorite").notNull().default(false),
    lastLoggedAt: timestamp("last_logged_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("member_food_items_member_updated_idx").on(
      table.gymId,
      table.memberClerkId,
      table.updatedAt,
    ),
    index("member_food_items_favorite_idx").on(table.gymId, table.memberClerkId, table.isFavorite),
    index("member_food_items_name_idx").on(table.gymId, table.memberClerkId, table.name),
  ],
);

export const foodLookupEvents = pgTable(
  "food_lookup_events",
  {
    id: text("id").primaryKey(),
    gymId: text("gym_id").notNull().default("gymos-main"),
    memberClerkId: text("member_clerk_id").notNull(),
    lookupType: text("lookup_type").notNull(),
    inputHash: text("input_hash"),
    barcode: text("barcode"),
    provider: text("provider"),
    status: text("status").notNull(),
    confidence: text("confidence"),
    selectedCatalogItemId: text("selected_catalog_item_id"),
    latencyMs: integer("latency_ms"),
    errorCode: text("error_code"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("food_lookup_events_member_created_idx").on(
      table.gymId,
      table.memberClerkId,
      table.createdAt,
    ),
    index("food_lookup_events_barcode_idx").on(table.barcode),
    index("food_lookup_events_provider_status_idx").on(
      table.provider,
      table.status,
      table.createdAt,
    ),
  ],
);

export type FoodCatalogItem = typeof foodCatalogItems.$inferSelect;
export type MemberFoodItem = typeof memberFoodItems.$inferSelect;
export type FoodLookupEvent = typeof foodLookupEvents.$inferSelect;
