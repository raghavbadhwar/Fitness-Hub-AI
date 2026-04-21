import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { searchExercises, EXERCISES } from "./exercises.ts";

describe("searchExercises", () => {
  describe("Category Filtering", () => {
    it('should return only Biceps and Triceps when category is "Arms"', () => {
      const results = searchExercises("", "Arms");
      assert(results.length > 0);
      results.forEach((e) => {
        assert(e.muscleGroup === "Biceps" || e.muscleGroup === "Triceps");
      });

      const hasBiceps = results.some(e => e.muscleGroup === "Biceps");
      const hasTriceps = results.some(e => e.muscleGroup === "Triceps");
      assert(hasBiceps, "Should contain Biceps exercises");
      assert(hasTriceps, "Should contain Triceps exercises");
    });

    it('should filter by muscleGroup when category is "Chest"', () => {
      const results = searchExercises("", "Chest");
      assert(results.length > 0);
      results.forEach((e) => {
        assert(e.muscleGroup === "Chest" || e.category === "Chest");
      });
      // In EXERCISES, Chest is a muscleGroup.
      assert(results.every(e => e.muscleGroup === "Chest"));
    });

    it('should filter by category when category is "Strength"', () => {
      const results = searchExercises("", "Strength");
      assert(results.length > 0);
      results.forEach((e) => {
        assert(e.category === "Strength" || e.muscleGroup === "Strength");
      });
      // In EXERCISES, Strength is a category.
      assert(results.every(e => e.category === "Strength"));
    });

    it('should return all exercises when category is "All"', () => {
      const results = searchExercises("", "All");
      assert.equal(results.length, EXERCISES.length);
    });

    it('should return all exercises when category is undefined', () => {
      const results = searchExercises("");
      assert.equal(results.length, EXERCISES.length);
    });
  });

  describe("Query Filtering", () => {
    it("should match by name case-insensitively", () => {
      const results = searchExercises("BENCH PRESS");
      assert(results.length > 0);
      assert(results.some((e) => e.name === "Bench Press"));
    });

    it("should match by muscleGroup", () => {
      const results = searchExercises("Back");
      assert(results.length > 0);
      assert(results.every((e) =>
        e.muscleGroup === "Back" ||
        e.name.toLowerCase().includes("back") ||
        e.category.toLowerCase().includes("back")
      ));
      assert(results.some(e => e.muscleGroup === "Back"));
    });

    it("should match by category", () => {
      const results = searchExercises("Yoga");
      assert(results.length > 0);
      assert(results.every((e) =>
        e.category === "Yoga" ||
        e.name.toLowerCase().includes("yoga") ||
        e.muscleGroup.toLowerCase().includes("yoga")
      ));
      assert(results.some(e => e.category === "Yoga"));
    });

    it("should return empty array for non-matching query", () => {
      const results = searchExercises("NonExistentExercise123");
      assert.equal(results.length, 0);
    });
  });

  describe("Combined Filtering", () => {
    it("should apply both category and query filters", () => {
      // "Dumbbell" query should match many, but "Chest" category should limit it
      const results = searchExercises("Dumbbell", "Chest");
      assert(results.length > 0);
      results.forEach((e) => {
        // Must satisfy category filter
        assert(e.muscleGroup === "Chest" || e.category === "Chest");
        // Must satisfy query filter
        const q = "dumbbell";
        assert(
          e.name.toLowerCase().includes(q) ||
          e.muscleGroup.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q)
        );
      });
    });

    it("should return empty when query does not match within category", () => {
      const results = searchExercises("Yoga", "Chest");
      assert.equal(results.length, 0);
    });
  });
});
