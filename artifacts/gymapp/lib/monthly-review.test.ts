import assert from "node:assert/strict";
import { test } from "node:test";
import type { UserProfile } from "../contexts/AppContext";

type MonthlyReviewModule = typeof import("./monthly-review");

async function loadMonthlyReview(): Promise<MonthlyReviewModule> {
  const moduleUrl = new URL(
    `./monthly-review.ts?nonce=${Date.now()}-${Math.random()}`,
    import.meta.url,
  );
  return (await import(moduleUrl.href)) as MonthlyReviewModule;
}

const profile: UserProfile = {
  name: "Raghav",
  age: 25,
  gender: "male",
  height: 175,
  weight: 72,
  targetWeight: 75,
  fitnessGoal: "build_muscle",
  activityLevel: "moderate",
  dietType: "non_veg",
  role: "member",
  dailyCalorieTarget: 2200,
  dailyProteinTarget: 150,
  dailyCarbTarget: 220,
  dailyFatTarget: 70,
  onboardingComplete: true,
  fitnessExperience: "intermediate",
  equipment: "commercial_gym",
  injuries: [],
  workoutTime: "morning",
  mealTiming: "3_meals",
  gymName: "GymOS",
  numTrainers: "2",
};

test("aggregates a calendar month from bounded local workout, nutrition, body, PR, and plan data", async () => {
  const { buildMonthlyReviewSnapshot } = await loadMonthlyReview();
  const review = buildMonthlyReviewSnapshot({
    month: "2026-05",
    today: new Date(2026, 4, 20),
    profile,
    sessions: [
      {
        id: "may_1",
        name: "Upper Strength",
        date: "2026-05-02",
        startTime: 1,
        duration: 55,
        exercises: [],
        totalVolume: 8200,
        caloriesBurned: 330,
        completed: true,
      },
      {
        id: "may_2",
        name: "Lower Strength",
        date: "2026-05-14",
        startTime: 2,
        duration: 65,
        exercises: [],
        totalVolume: 9400,
        caloriesBurned: 390,
        completed: true,
      },
      {
        id: "april",
        name: "Mobility",
        date: "2026-04-10",
        startTime: 3,
        duration: 35,
        exercises: [],
        totalVolume: 1000,
        caloriesBurned: 120,
        completed: true,
      },
    ],
    nutritionLogs: [
      {
        date: "2026-05-01",
        waterIntake: 8,
        entries: [
          {
            id: "food_1",
            foodId: "eggs",
            name: "Eggs",
            mealType: "breakfast",
            servings: 1,
            servingSize: "1 plate",
            calories: 2140,
            protein: 145,
            carbs: 180,
            fat: 60,
            fiber: 8,
            timestamp: 1,
          },
        ],
      },
      {
        date: "2026-05-02",
        waterIntake: 7,
        entries: [
          {
            id: "food_2",
            foodId: "chicken",
            name: "Chicken Bowl",
            mealType: "lunch",
            servings: 1,
            servingSize: "1 bowl",
            calories: 2300,
            protein: 155,
            carbs: 210,
            fat: 70,
            fiber: 6,
            timestamp: 2,
          },
        ],
      },
      {
        date: "2026-04-10",
        waterIntake: 8,
        entries: [],
      },
    ],
    weightLog: [
      { date: "2026-05-01", weight: 72.2 },
      { date: "2026-05-18", weight: 71.4 },
    ],
    bodyMeasurements: [
      { date: "2026-05-01", waist: 88.2 },
      { date: "2026-05-18", waist: 87.1 },
    ],
    personalRecords: [
      { exerciseId: "bench", name: "Bench Press", weight: 80, reps: 5, date: "2026-05-14" },
      { exerciseId: "squat", name: "Squat", weight: 100, reps: 3, date: "2026-04-09" },
    ],
    savedPlans: [
      {
        id: "plan_1",
        name: "Push Repeat",
        focus: "push",
        source: "member",
        createdAt: "2026-05-03T10:00:00.000Z",
        updatedAt: "2026-05-03T10:00:00.000Z",
        exercises: [],
      },
    ],
  });

  assert.equal(review.metrics.monthLabel, "May 2026");
  assert.equal(review.metrics.elapsedDays, 20);
  assert.equal(review.metrics.completedWorkouts, 2);
  assert.equal(review.metrics.totalVolume, 17600);
  assert.equal(review.metrics.nutritionLoggedDays, 2);
  assert.equal(review.metrics.prCount, 1);
  assert.equal(review.metrics.bestLiftName, "Bench Press");
  assert.equal(review.metrics.weightDelta, -0.8);
  assert.equal(review.metrics.bodyMeasurementsLogged, 2);
  assert.equal(review.metrics.plansSavedThisMonth, 1);
});

test("returns a useful starting point for an empty partial month", async () => {
  const { buildMonthlyReviewSnapshot } = await loadMonthlyReview();
  const review = buildMonthlyReviewSnapshot({
    month: "2026-05",
    today: new Date(2026, 4, 5),
    profile,
    sessions: [],
    nutritionLogs: [],
    weightLog: [],
    bodyMeasurements: [],
    personalRecords: [],
    savedPlans: [],
  });

  assert.equal(review.isCurrentMonth, true);
  assert.equal(review.metrics.completedWorkouts, 0);
  assert.equal(review.metrics.momentum, "starting");
  assert.ok(review.badges.some((badge) => badge.id === "starting_point"));
  assert.ok(review.suggestedAdjustments.some((item) => item.category === "workout"));
});

test("handles month boundaries, completed months, and edited nutrition logs", async () => {
  const { buildMonthlyReviewSnapshot, getMonthWindow } = await loadMonthlyReview();
  const window = getMonthWindow("2026-04", new Date(2026, 4, 3));
  const review = buildMonthlyReviewSnapshot({
    month: "2026-04",
    today: new Date(2026, 4, 3),
    profile,
    sessions: [
      {
        id: "march",
        name: "March",
        date: "2026-03-31",
        startTime: 1,
        duration: 45,
        exercises: [],
        totalVolume: 5000,
        caloriesBurned: 200,
        completed: true,
      },
      {
        id: "april",
        name: "April",
        date: "2026-04-01",
        startTime: 2,
        duration: 50,
        exercises: [],
        totalVolume: 6000,
        caloriesBurned: 250,
        completed: true,
      },
    ],
    nutritionLogs: [
      {
        date: "2026-04-02",
        waterIntake: 6,
        entries: [
          {
            id: "edited",
            foodId: "protein",
            name: "Edited Protein Day",
            mealType: "dinner",
            servings: 1,
            servingSize: "1 meal",
            calories: 2200,
            protein: 160,
            carbs: 210,
            fat: 65,
            fiber: 8,
            timestamp: 4,
          },
        ],
      },
    ],
    weightLog: [],
    bodyMeasurements: [],
    personalRecords: [],
    savedPlans: [],
  });

  assert.equal(window.isCompleteMonth, true);
  assert.equal(window.elapsedDays, 30);
  assert.equal(review.metrics.completedWorkouts, 1);
  assert.equal(review.metrics.avgProtein, 160);
  assert.equal(review.metrics.nutritionAdherenceRate, 3);
  assert.equal(review.isCompleteMonth, true);
});
