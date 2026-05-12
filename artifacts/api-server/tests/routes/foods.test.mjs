import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import express from "express";
import request from "supertest";

const authState = { userId: "member_1", gymId: "gymos-main", allowed: true };
const catalogRows = new Map();
const memberFoodRows = new Map();
const lookupEvents = [];

const foodCatalogItems = {
  id: Symbol("foodCatalogItems.id"),
  source: Symbol("foodCatalogItems.source"),
  sourceProductId: Symbol("foodCatalogItems.sourceProductId"),
  barcode: Symbol("foodCatalogItems.barcode"),
  name: Symbol("foodCatalogItems.name"),
  brand: Symbol("foodCatalogItems.brand"),
  qualityScore: Symbol("foodCatalogItems.qualityScore"),
};

const memberFoodItems = {
  id: Symbol("memberFoodItems.id"),
  gymId: Symbol("memberFoodItems.gymId"),
  memberClerkId: Symbol("memberFoodItems.memberClerkId"),
  name: Symbol("memberFoodItems.name"),
  isFavorite: Symbol("memberFoodItems.isFavorite"),
  updatedAt: Symbol("memberFoodItems.updatedAt"),
};

const foodLookupEvents = {
  id: Symbol("foodLookupEvents.id"),
};

const fieldMap = new Map([
  [foodCatalogItems.id, "id"],
  [foodCatalogItems.source, "source"],
  [foodCatalogItems.sourceProductId, "sourceProductId"],
  [foodCatalogItems.barcode, "barcode"],
  [foodCatalogItems.name, "name"],
  [foodCatalogItems.brand, "brand"],
  [memberFoodItems.id, "id"],
  [memberFoodItems.gymId, "gymId"],
  [memberFoodItems.memberClerkId, "memberClerkId"],
  [memberFoodItems.name, "name"],
  [memberFoodItems.isFavorite, "isFavorite"],
]);

mock.module("drizzle-orm", {
  namedExports: {
    and(...conditions) {
      return { op: "and", conditions };
    },
    desc(field) {
      return { op: "desc", field };
    },
    eq(field, value) {
      return { op: "eq", field, value };
    },
    ilike(field, value) {
      return { op: "ilike", field, value };
    },
    or(...conditions) {
      return { op: "or", conditions };
    },
  },
});

mock.module("@clerk/express", {
  namedExports: {
    requireAuth() {
      return (_req, res, next) => {
        if (!authState.userId) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }
        next();
      };
    },
    getAuth() {
      return { userId: authState.userId };
    },
  },
});

function cloneRow(row) {
  return {
    ...row,
    ingredients: Array.isArray(row.ingredients) ? [...row.ingredients] : row.ingredients,
    allergens: Array.isArray(row.allergens) ? [...row.allergens] : row.allergens,
    portionOptions: Array.isArray(row.portionOptions)
      ? row.portionOptions.map((option) => ({ ...option }))
      : row.portionOptions,
    createdAt: row.createdAt instanceof Date ? new Date(row.createdAt) : row.createdAt,
    updatedAt: row.updatedAt instanceof Date ? new Date(row.updatedAt) : row.updatedAt,
    lastLoggedAt: row.lastLoggedAt instanceof Date ? new Date(row.lastLoggedAt) : row.lastLoggedAt,
  };
}

function rowsForTable(table) {
  if (table === foodCatalogItems) return [...catalogRows.values()];
  if (table === memberFoodItems) return [...memberFoodRows.values()];
  return [];
}

function matchesCondition(row, condition) {
  if (!condition) return true;
  if (condition.op === "and") {
    return condition.conditions.every((child) => matchesCondition(row, child));
  }
  if (condition.op === "or") {
    return condition.conditions.some((child) => matchesCondition(row, child));
  }
  if (condition.op === "ilike") {
    const fieldName = fieldMap.get(condition.field);
    const value = String(row[fieldName] ?? "").toLowerCase();
    const pattern = String(condition.value ?? "")
      .replaceAll("%", "")
      .toLowerCase();
    return value.includes(pattern);
  }
  if (condition.op === "eq") {
    const fieldName = fieldMap.get(condition.field);
    return fieldName ? row[fieldName] === condition.value : true;
  }
  return true;
}

function saveTableRow(table, values) {
  const now = new Date("2026-05-10T10:00:00.000Z");
  const row = {
    createdAt: now,
    updatedAt: now,
    ...values,
  };
  if (table === foodCatalogItems) catalogRows.set(row.id, cloneRow(row));
  if (table === memberFoodItems) memberFoodRows.set(row.id, cloneRow(row));
  if (table === foodLookupEvents) lookupEvents.push(cloneRow(row));
  return cloneRow(row);
}

mock.module("@workspace/db", {
  namedExports: {
    db: {
      select() {
        return {
          from(table) {
            const makeQuery = (condition) => ({
              orderBy() {
                return {
                  limit(count) {
                    return Promise.resolve(
                      rowsForTable(table)
                        .filter((row) => matchesCondition(row, condition))
                        .slice(0, count)
                        .map(cloneRow),
                    );
                  },
                };
              },
              limit(count) {
                return Promise.resolve(
                  rowsForTable(table)
                    .filter((row) => matchesCondition(row, condition))
                    .slice(0, count)
                    .map(cloneRow),
                );
              },
              then(resolve, reject) {
                return Promise.resolve(
                  rowsForTable(table)
                    .filter((row) => matchesCondition(row, condition))
                    .map(cloneRow),
                ).then(resolve, reject);
              },
            });

            return {
              where(condition) {
                return makeQuery(condition);
              },
            };
          },
        };
      },
      insert(table) {
        return {
          values(values) {
            if (table === foodLookupEvents) {
              saveTableRow(table, values);
              return Promise.resolve();
            }
            const returning = () => Promise.resolve([saveTableRow(table, values)]);
            return {
              returning,
              onConflictDoUpdate() {
                return { returning };
              },
            };
          },
        };
      },
    },
    foodCatalogItems,
    foodLookupEvents,
    memberFoodItems,
  },
});

mock.module("../../src/lib/user-access.ts", {
  namedExports: {
    async requireApprovedAccess(_req, res) {
      if (!authState.userId) {
        res.status(401).json({ error: "Unauthorized" });
        return null;
      }
      if (!authState.allowed) {
        res.status(403).json({ error: "Access revoked" });
        return null;
      }
      return {
        allowed: true,
        userId: authState.userId,
        email: "member@example.com",
        role: "member",
        gymId: authState.gymId,
        profile: null,
        control: null,
      };
    },
  },
});

const { default: foodsRouter } = await import("../../src/routes/foods.ts");

const app = express();
app.use(express.json());
app.use("/foods", foodsRouter);

beforeEach(() => {
  authState.userId = "member_1";
  authState.gymId = "gymos-main";
  authState.allowed = true;
  delete process.env.FOOD_SEARCH_ENABLE_PAID_PROVIDERS;
  delete process.env.FOODDATA_CENTRAL_API_KEY;
  delete process.env.NUTRITIONIX_APP_ID;
  delete process.env.NUTRITIONIX_API_KEY;
  delete process.env.NUTRITIONIX_REMOTE_USER_ID;
  delete process.env.NUTRITIONIX_TIMEOUT_MS;
  catalogRows.clear();
  memberFoodRows.clear();
  lookupEvents.length = 0;
  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      return { status: 0 };
    },
  });
});

describe("foods routes", () => {
  it("returns cached barcode foods with portion and provenance metadata", async () => {
    catalogRows.set("food_1", {
      id: "food_1",
      source: "open_food_facts",
      sourceProductId: "8901234567890",
      barcode: "8901234567890",
      name: "Masala Oats",
      brand: "Example",
      defaultServingLabel: "1 pack",
      defaultServingGrams: 40,
      caloriesPer100g: 380,
      proteinPer100g: 12,
      carbsPer100g: 60,
      fatPer100g: 9,
      fiberPer100g: 8,
      sugarPer100g: 4,
      sodiumMgPer100g: 700,
      ingredients: ["oats", "spices"],
      allergens: ["gluten"],
      portionOptions: [{ label: "1 pack", grams: 40 }],
      qualityScore: 82,
      createdAt: new Date("2026-05-09T10:00:00.000Z"),
      updatedAt: new Date("2026-05-09T10:00:00.000Z"),
    });

    const response = await request(app).get("/foods/barcode/8901234567890");

    assert.equal(response.status, 200);
    assert.equal(response.body.item.name, "Masala Oats");
    assert.equal(response.body.item.calories, 152);
    assert.equal(response.body.item.provenance.cached, true);
    assert.equal(response.body.item.confidence, "high");
    assert.equal(lookupEvents[0].status, "cache_hit");
  });

  it("falls back to manual or label entry when barcode providers miss", async () => {
    const response = await request(app).get("/foods/barcode/8900000000000");

    assert.equal(response.status, 404);
    assert.deepEqual(response.body, {
      error: "Food barcode not found",
      fallbackUsed: "manual_or_label",
    });
    assert.equal(lookupEvents[0].status, "not_found");
  });

  it("keeps Indian portions available in food search fallback", async () => {
    const response = await request(app).get("/foods/search?q=roti");

    assert.equal(response.status, 200);
    assert.equal(response.body.items[0].name, "Roti / Chapati");
    assert.deepEqual(
      response.body.items[0].portionOptions.map((option) => option.label),
      ["1 phulka", "1 medium roti", "1 large roti"],
    );
  });

  it("expands tea and chai synonyms across Indian and healthy beverage options", async () => {
    const response = await request(app).get("/foods/search?q=tea&limit=10");

    assert.equal(response.status, 200);
    const names = response.body.items.map((item) => item.name);
    assert.ok(names.includes("Masala Chai"));
    assert.ok(names.includes("Green Tea"));
    assert.ok(names.includes("Black Tea"));
  });

  it("handles coffee family synonyms and common misspellings", async () => {
    const coffeeResponse = await request(app).get("/foods/search?q=coffee&limit=10");
    const cappuccinoResponse = await request(app).get("/foods/search?q=cappuccino&limit=10");
    const typoResponse = await request(app).get("/foods/search?q=capuccino&limit=10");

    assert.equal(coffeeResponse.status, 200);
    assert.equal(cappuccinoResponse.status, 200);
    assert.equal(typoResponse.status, 200);
    const coffeeNames = coffeeResponse.body.items.map((item) => item.name);
    const cappuccinoNames = cappuccinoResponse.body.items.map((item) => item.name);
    const typoNames = typoResponse.body.items.map((item) => item.name);
    assert.ok(coffeeNames.includes("Cappuccino"));
    assert.ok(coffeeNames.includes("Frappe"));
    assert.ok(cappuccinoNames.includes("Coffee"));
    assert.ok(cappuccinoNames.includes("Frappe"));
    assert.ok(typoNames.includes("Cappuccino"));
  });

  it("returns common global fast foods and bakery items from curated fallback", async () => {
    const queries = [
      ["burger", "Burger"],
      ["momos", "Momos / Dumplings"],
      ["noodles", "Hakka Noodles"],
      ["french fries", "French Fries"],
      ["pizzas", "Margherita Pizza"],
      ["croissant", "Croissant"],
      ["garlic bread", "Garlic Bread"],
    ];

    for (const [query, expectedName] of queries) {
      const response = await request(app).get(
        `/foods/search?q=${encodeURIComponent(query)}&limit=10`,
      );
      assert.equal(response.status, 200);
      assert.ok(
        response.body.items.some((item) => item.name === expectedName),
        `${query} should include ${expectedName}`,
      );
    }
  });

  it("uses Open Food Facts public search before curated fallback", async () => {
    const calls = [];
    globalThis.fetch = async (url) => {
      calls.push(String(url));
      return {
        ok: true,
        async json() {
          return {
            products: [
              {
                code: "8901230001112",
                product_name: "Protein Bar",
                brands: "Example Foods",
                categories: "Protein bars",
                serving_size: "1 bar",
                serving_quantity: 60,
                nutriments: {
                  "energy-kcal_100g": 400,
                  proteins_100g: 25,
                  carbohydrates_100g: 45,
                  fat_100g: 12,
                  fiber_100g: 8,
                  sugars_100g: 10,
                  sodium_100g: 0.22,
                },
                ingredients_text: "oats, whey protein, cocoa",
                allergens_tags: ["en:milk"],
              },
            ],
          };
        },
      };
    };

    const response = await request(app).get("/foods/search?q=protein%20bar&limit=5");

    assert.equal(response.status, 200);
    assert.equal(response.body.items[0].source, "open_food_facts");
    assert.equal(response.body.items[0].name, "Protein Bar");
    assert.equal(response.body.items[0].brand, "Example Foods");
    assert.equal(response.body.items[0].calories, 240);
    assert.equal(response.body.items[0].provenance.provider, "open_food_facts_search");
    assert.ok(calls.some((call) => call.includes("world.openfoodfacts.org/cgi/search.pl")));
    assert.equal(lookupEvents[0].provider.includes("open_food_facts"), true);
  });

  it("keeps curated fallback results when Open Food Facts search fails", async () => {
    globalThis.fetch = async () => {
      throw new Error("provider down");
    };

    const response = await request(app).get("/foods/search?q=garlic%20bread&limit=5");

    assert.equal(response.status, 200);
    assert.equal(response.body.fallbackUsed, "open_food_facts_provider_error");
    assert.ok(response.body.items.some((item) => item.name === "Garlic Bread"));
    assert.equal(lookupEvents[0].provider.includes("open_food_facts_error"), true);
  });

  it("skips USDA when its free API key is missing", async () => {
    const calls = [];
    globalThis.fetch = async (url) => {
      calls.push(String(url));
      return {
        ok: true,
        async json() {
          return { products: [] };
        },
      };
    };

    const response = await request(app).get("/foods/search?q=burger&limit=5");

    assert.equal(response.status, 200);
    assert.ok(response.body.items.some((item) => item.name === "Burger"));
    assert.ok(calls.some((call) => call.includes("world.openfoodfacts.org/cgi/search.pl")));
    assert.equal(
      calls.some((call) => call.includes("api.nal.usda.gov")),
      false,
    );
  });

  it("uses USDA when the free key exists and Open Food Facts does not fill the limit", async () => {
    process.env.FOODDATA_CENTRAL_API_KEY = "free_usda_key";
    const calls = [];
    globalThis.fetch = async (url) => {
      calls.push(String(url));
      if (String(url).includes("world.openfoodfacts.org")) {
        return {
          ok: true,
          async json() {
            return { products: [] };
          },
        };
      }
      if (String(url).includes("api.nal.usda.gov")) {
        return {
          ok: true,
          async json() {
            return {
              foods: [
                {
                  fdcId: 123,
                  description: "BURGER, PLAIN",
                  foodNutrients: [
                    { nutrientName: "Energy", value: 260 },
                    { nutrientName: "Protein", value: 17 },
                    { nutrientName: "Carbohydrate, by difference", value: 31 },
                    { nutrientName: "Total lipid (fat)", value: 9 },
                    { nutrientName: "Fiber, total dietary", value: 2 },
                  ],
                },
              ],
            };
          },
        };
      }
      return {
        ok: false,
        async json() {
          return {};
        },
      };
    };

    const response = await request(app).get("/foods/search?q=burger&limit=5");

    assert.equal(response.status, 200);
    assert.ok(response.body.items.some((item) => item.source === "usda"));
    assert.ok(calls.some((call) => call.includes("api.nal.usda.gov")));
  });

  it("does not call Nutritionix when paid provider keys exist but the paid flag is disabled", async () => {
    process.env.NUTRITIONIX_APP_ID = "nutritionix_app";
    process.env.NUTRITIONIX_API_KEY = "nutritionix_key";
    const calls = [];
    globalThis.fetch = async (url) => {
      calls.push(String(url));
      return {
        ok: true,
        async json() {
          return { products: [] };
        },
      };
    };

    const response = await request(app).get("/foods/search?q=cappuccino&limit=5");

    assert.equal(response.status, 200);
    assert.equal(
      calls.some((call) => call.includes("trackapi.nutritionix.com")),
      false,
    );
    assert.ok(calls.some((call) => call.includes("world.openfoodfacts.org/cgi/search.pl")));
    assert.equal(lookupEvents[0].provider.includes("paid_provider_disabled"), true);
  });

  it("uses Nutritionix only when paid providers are explicitly enabled", async () => {
    process.env.FOOD_SEARCH_ENABLE_PAID_PROVIDERS = "true";
    process.env.NUTRITIONIX_APP_ID = "nutritionix_app";
    process.env.NUTRITIONIX_API_KEY = "nutritionix_key";
    const calls = [];
    globalThis.fetch = async (url, options = {}) => {
      calls.push({ url: String(url), method: options.method ?? "GET" });
      if (String(url).includes("/search/instant")) {
        return {
          ok: true,
          async json() {
            return {
              common: [
                { food_name: "cappuccino", tag_id: "tag_cappuccino" },
                { food_name: "coffee", tag_id: "tag_coffee" },
              ],
              branded: [],
            };
          },
        };
      }
      if (String(url).includes("/natural/nutrients")) {
        const body = JSON.parse(String(options.body ?? "{}"));
        const isCoffee = body.query === "coffee";
        return {
          ok: true,
          async json() {
            return {
              foods: [
                {
                  food_name: isCoffee ? "coffee" : "cappuccino",
                  tag_id: isCoffee ? "tag_coffee" : "tag_cappuccino",
                  serving_qty: 1,
                  serving_unit: isCoffee ? "cup" : "medium cup",
                  serving_weight_grams: isCoffee ? 240 : 180,
                  nf_calories: isCoffee ? 5 : 120,
                  nf_protein: isCoffee ? 0.3 : 6,
                  nf_total_carbohydrate: isCoffee ? 1 : 12,
                  nf_total_fat: isCoffee ? 0 : 5,
                  nf_dietary_fiber: 0,
                  nf_sugars: isCoffee ? 0 : 10,
                  nf_sodium: isCoffee ? 5 : 90,
                },
              ],
            };
          },
        };
      }
      if (String(url).includes("world.openfoodfacts.org")) {
        return {
          ok: true,
          async json() {
            return { products: [] };
          },
        };
      }
      return {
        ok: false,
        async json() {
          return {};
        },
      };
    };

    const response = await request(app).get("/foods/search?q=cappuccino&limit=5");

    assert.equal(response.status, 200);
    assert.equal(response.body.items[0].source, "nutritionix");
    assert.equal(response.body.items[0].provenance.provider, "nutritionix");
    assert.equal(response.body.items[0].name, "cappuccino");
    assert.ok(response.body.items.some((item) => item.name === "coffee"));
    assert.ok(calls.some((call) => call.url.includes("/search/instant")));
    assert.ok(calls.some((call) => call.url.includes("/natural/nutrients")));
    assert.equal(lookupEvents[0].provider.includes("nutritionix"), true);
  });

  it("keeps curated fallback results when paid Nutritionix and free Open Food Facts both fail", async () => {
    process.env.FOOD_SEARCH_ENABLE_PAID_PROVIDERS = "true";
    process.env.NUTRITIONIX_APP_ID = "nutritionix_app";
    process.env.NUTRITIONIX_API_KEY = "nutritionix_key";
    globalThis.fetch = async () => {
      throw new Error("provider down");
    };

    const response = await request(app).get("/foods/search?q=garlic%20bread&limit=5");

    assert.equal(response.status, 200);
    assert.equal(response.body.fallbackUsed, "open_food_facts_provider_error");
    assert.ok(response.body.items.some((item) => item.name === "Garlic Bread"));
    assert.equal(lookupEvents[0].provider.includes("nutritionix_error"), true);
    assert.equal(lookupEvents[0].provider.includes("open_food_facts_error"), true);
  });

  it("matches misspelled Indian and global healthy foods", async () => {
    const biryaniResponse = await request(app).get("/foods/search?q=briyani&limit=10");
    const broccoliResponse = await request(app).get("/foods/search?q=brocoli&limit=10");

    assert.equal(biryaniResponse.status, 200);
    assert.equal(broccoliResponse.status, 200);
    assert.ok(biryaniResponse.body.items.some((item) => item.name === "Chicken Biryani"));
    assert.ok(broccoliResponse.body.items.some((item) => item.name === "Broccoli"));
  });

  it("covers non-Indian cuisines commonly eaten by Indian users", async () => {
    const response = await request(app).get("/foods/search?q=thai&limit=10");

    assert.equal(response.status, 200);
    const names = response.body.items.map((item) => item.name);
    assert.ok(names.includes("Thai Green Curry"));
    assert.ok(names.includes("Pad Thai"));
  });

  it("saves corrected custom foods for the signed-in member", async () => {
    const response = await request(app)
      .post("/foods/custom")
      .send({
        name: "Homemade Paneer Sandwich",
        servingLabel: "1 sandwich",
        servingGrams: 180,
        calories: 420,
        protein: 24,
        carbs: 42,
        fat: 16,
        fiber: 5,
        source: "label",
        confidence: "high",
        isFavorite: true,
        portionOptions: [{ label: "half sandwich", grams: 90 }],
      });

    assert.equal(response.status, 201);
    assert.equal(response.body.item.name, "Homemade Paneer Sandwich");
    assert.equal(response.body.item.source, "member_custom");
    assert.equal(response.body.item.servingGrams, 180);
    assert.equal(memberFoodRows.size, 1);
  });

  it("rejects custom foods with invalid macros", async () => {
    const response = await request(app).post("/foods/custom").send({
      name: "Broken Food",
      calories: -1,
      protein: 1,
      carbs: 1,
      fat: 1,
    });

    assert.equal(response.status, 400);
    assert.deepEqual(response.body, {
      error: "name and finite non-negative macros are required",
    });
  });
});
