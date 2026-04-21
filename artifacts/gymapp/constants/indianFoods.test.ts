import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { searchFoods, INDIAN_FOODS } from "./indianFoods";

describe("searchFoods", () => {
  it("should return all foods when query is empty", () => {
    const result = searchFoods("");
    assert.equal(result.length, INDIAN_FOODS.length);
  });

  it("should match by exact name", () => {
    const result = searchFoods("Roti / Chapati");
    assert.ok(result.length > 0);
    assert.equal(result[0].id, "roti");
  });

  it("should match by partial name", () => {
    const result = searchFoods("Roti");
    assert.ok(result.length > 0);
    assert.ok(result.some((food) => food.id === "roti"));
  });

  it("should match case-insensitively for name", () => {
    const result1 = searchFoods("roti");
    const result2 = searchFoods("ROTI");

    assert.ok(result1.length > 0);
    assert.deepEqual(result1, result2);
    assert.ok(result1.some((food) => food.id === "roti"));
  });

  it("should match by category", () => {
    const breadCategoryFoods = INDIAN_FOODS.filter((f) => f.category === "Breads");
    const result = searchFoods("Breads");

    assert.ok(result.length > 0);
    // Since searchFoods checks if query is included, "Breads" will match all breads.
    assert.equal(result.length, breadCategoryFoods.length);
  });

  it("should match case-insensitively for category", () => {
    const breadCategoryFoods = INDIAN_FOODS.filter((f) => f.category === "Breads");
    const result = searchFoods("breads");

    assert.ok(result.length > 0);
    assert.equal(result.length, breadCategoryFoods.length);
  });

  it("should return an empty array when there are no matches", () => {
    const result = searchFoods("ThisFoodDoesNotExist123");
    assert.deepEqual(result, []);
  });

  it("should match items with multiple criteria logically matching (partial category/name)", () => {
    // "bev" should match Beverages category
    const beverageCategoryFoods = INDIAN_FOODS.filter((f) => f.category === "Beverages");
    const result = searchFoods("bev");
    assert.ok(result.length > 0);
    assert.equal(result.length, beverageCategoryFoods.length);
  });
});
