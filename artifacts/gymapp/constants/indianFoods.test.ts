import assert from "node:assert/strict";
import { test } from "node:test";
import { INDIAN_FOODS, searchFoods } from "./indianFoods.ts";

test("local food fallback includes common global foods Indian users search for", () => {
  const expectedFoods = [
    "Burger",
    "Momos / Dumplings",
    "Hakka Noodles",
    "French Fries",
    "Margherita Pizza",
    "Croissant",
    "Garlic Bread",
  ];

  for (const expectedFood of expectedFoods) {
    assert.ok(
      INDIAN_FOODS.some((food) => food.name === expectedFood),
      `${expectedFood} should be available in the local catalog`,
    );
  }
});

test("local food fallback searches aliases, plurals, and typo-like variants", () => {
  const cases = [
    ["pizzas", "Margherita Pizza"],
    ["momo", "Momos / Dumplings"],
    ["fries", "French Fries"],
    ["crossaint", "Croissant"],
    ["garlic toast", "Garlic Bread"],
    ["capuccino", "Cappuccino"],
  ];

  for (const [query, expectedFood] of cases) {
    assert.ok(
      searchFoods(query).some((food) => food.name === expectedFood),
      `${query} should match ${expectedFood}`,
    );
  }
});

test("local cappuccino search returns the wider coffee family", () => {
  const names = searchFoods("cappuccino").map((food) => food.name);

  assert.ok(names.includes("Cappuccino"));
  assert.ok(names.includes("Black Coffee"));
  assert.ok(names.includes("Frappe"));
});
