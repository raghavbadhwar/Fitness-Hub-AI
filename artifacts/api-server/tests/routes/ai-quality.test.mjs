import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  scoreFoodAnalysisQuality,
  scoreWorkoutSuggestionQuality,
} from "../../src/lib/ai-quality.ts";

describe("ai quality regression fixtures", () => {
  it("accepts a bounded workout that fits time and injury constraints", () => {
    const result = scoreWorkoutSuggestionQuality(
      {
        duration: 42,
        warmup: "5 minutes easy bike and shoulder circles",
        cooldown: "light stretching",
        exercises: [
          { name: "Goblet Squat" },
          { name: "Chest Supported Row" },
          { name: "Dumbbell Bench Press" },
        ],
      },
      { availableTime: 45, injuries: ["lower_back"] },
    );

    assert.deepEqual(result, { ok: true, issues: [] });
  });

  it("flags workout plans that violate injury and duration constraints", () => {
    const result = scoreWorkoutSuggestionQuality(
      {
        duration: 90,
        warmup: "",
        cooldown: "stretch",
        exercises: [{ name: "Deadlift" }],
      },
      { availableTime: 45, injuries: ["lower_back"] },
    );

    assert.equal(result.ok, false);
    assert.match(result.issues.join("\n"), /three exercises/);
    assert.match(result.issues.join("\n"), /duration exceeds/);
    assert.match(result.issues.join("\n"), /lower_back/);
  });

  it("accepts food analysis with sane nutrition ranges and confidence", () => {
    const result = scoreFoodAnalysisQuality({
      calories: 520,
      protein: 34,
      carbs: 52,
      fat: 18,
      fiber: 7,
      confidence: "medium",
      ingredients: ["rice", "paneer", "vegetables"],
    });

    assert.deepEqual(result, { ok: true, issues: [] });
  });

  it("flags impossible food analysis values", () => {
    const result = scoreFoodAnalysisQuality({
      calories: 9000,
      protein: 12,
      carbs: 30,
      fat: 10,
      fiber: 4,
      confidence: "certain",
      ingredients: [],
    });

    assert.equal(result.ok, false);
    assert.match(result.issues.join("\n"), /calories/);
    assert.match(result.issues.join("\n"), /confidence/);
    assert.match(result.issues.join("\n"), /ingredients/);
  });
});
