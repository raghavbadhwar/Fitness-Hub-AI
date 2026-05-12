import assert from "node:assert/strict";
import { test } from "node:test";
import { getRecentUniqueFoodEntries } from "./nutrition-history.ts";
import type { DailyLog } from "../contexts/NutritionContext";

const logs: Record<string, DailyLog> = {
  "2026-05-08": {
    date: "2026-05-08",
    waterIntake: 4,
    entries: [
      {
        id: "old-paneer",
        foodId: "paneer",
        name: "Paneer Bowl",
        mealType: "lunch",
        servings: 1,
        servingSize: "1 bowl",
        calories: 520,
        protein: 32,
        carbs: 44,
        fat: 20,
        fiber: 6,
        timestamp: 100,
      },
    ],
  },
  "2026-05-09": {
    date: "2026-05-09",
    waterIntake: 6,
    entries: [
      {
        id: "new-paneer",
        foodId: "paneer",
        name: "Paneer Bowl",
        mealType: "dinner",
        servings: 1,
        servingSize: "1 bowl",
        calories: 520,
        protein: 32,
        carbs: 44,
        fat: 20,
        fiber: 6,
        timestamp: 300,
      },
      {
        id: "dal",
        foodId: "dal",
        name: "Dal",
        mealType: "dinner",
        servings: 1,
        servingSize: "1 bowl",
        calories: 210,
        protein: 12,
        carbs: 28,
        fat: 5,
        fiber: 7,
        timestamp: 200,
      },
    ],
  },
};

test("getRecentUniqueFoodEntries returns newest deduped foods", () => {
  const recent = getRecentUniqueFoodEntries(logs, 3);

  assert.deepEqual(
    recent.map((entry) => entry.id),
    ["new-paneer", "dal"],
  );
});
