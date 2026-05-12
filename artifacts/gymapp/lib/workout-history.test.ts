import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildExerciseHistorySummary,
  buildPreviousExerciseSetLookup,
  hydrateSessionExercisesFromHistory,
  hydrateExercisesWithPreviousSets,
} from "./workout-history.ts";
import type { WorkoutExercise, WorkoutSession } from "../contexts/WorkoutContext";

const olderSession: WorkoutSession = {
  id: "old-session",
  name: "Old Push",
  date: "2026-05-01",
  startTime: 100,
  endTime: 200,
  duration: 45,
  exercises: [
    {
      id: "old-exercise",
      exerciseId: "bench_press",
      name: "Bench Press",
      sets: [{ id: "old-set", weight: 60, reps: 8, completed: true }],
    },
  ],
  totalVolume: 480,
  caloriesBurned: 200,
  completed: true,
};

const recentSession: WorkoutSession = {
  id: "recent-session",
  name: "Recent Push",
  date: "2026-05-08",
  startTime: 300,
  endTime: 400,
  duration: 50,
  exercises: [
    {
      id: "recent-exercise",
      exerciseId: "bench_press",
      name: "Bench Press",
      sets: [
        { id: "recent-set-1", weight: 82.5, reps: 5, completed: true, type: "normal", rpe: 8 },
        { id: "recent-set-2", weight: 80, reps: 6, completed: true, type: "drop", rir: 1 },
      ],
    },
  ],
  totalVolume: 892,
  caloriesBurned: 250,
  completed: true,
};

test("buildPreviousExerciseSetLookup uses the most recent completed exercise sets", () => {
  const lookup = buildPreviousExerciseSetLookup([olderSession, recentSession]);

  assert.deepEqual(lookup.bench_press, [
    { weight: 82.5, reps: 5, type: "normal", rpe: 8 },
    { weight: 80, reps: 6, type: "drop", rir: 1 },
  ]);
});

test("hydrateExercisesWithPreviousSets preloads saved plan sets from history", () => {
  const exercises = hydrateExercisesWithPreviousSets(
    [
      {
        exerciseId: "bench_press",
        name: "Bench Press",
        sets: [
          { id: "new-set-1", weight: 0, reps: 10, completed: false },
          { id: "new-set-2", weight: 0, reps: 10, completed: false },
          { id: "new-set-3", weight: 0, reps: 10, completed: false },
        ],
      },
      {
        exerciseId: "squat",
        name: "Squat",
        sets: [{ id: "squat-set-1", weight: 0, reps: 5, completed: false }],
      },
    ],
    buildPreviousExerciseSetLookup([recentSession]),
  );

  assert.deepEqual(exercises[0]?.sets, [
    {
      id: "new-set-1",
      weight: 82.5,
      reps: 5,
      completed: false,
      previousWeight: 82.5,
      previousReps: 5,
      progressionHint: "Last: 82.5kg x 5",
      type: "normal",
    },
    {
      id: "new-set-2",
      weight: 80,
      reps: 6,
      completed: false,
      previousWeight: 80,
      previousReps: 6,
      progressionHint: "Last: 80kg x 6",
      type: "normal",
    },
    { id: "new-set-3", weight: 0, reps: 10, completed: false },
  ]);
  assert.deepEqual(exercises[1]?.sets, [
    { id: "squat-set-1", weight: 0, reps: 5, completed: false },
  ]);
});

test("buildExerciseHistorySummary captures last sets and best estimated max", () => {
  const summary = buildExerciseHistorySummary([olderSession, recentSession], "bench_press");

  assert.deepEqual(summary, {
    lastPerformedAt: 400,
    lastSets: [
      { weight: 82.5, reps: 5, type: "normal", rpe: 8 },
      { weight: 80, reps: 6, type: "drop", rir: 1 },
    ],
    bestEstimatedOneRepMax: 96,
  });
});

test("hydrateSessionExercisesFromHistory preloads quick-start and AI session exercises", () => {
  const quickStartExercises: Array<Omit<WorkoutExercise, "id">> = [
    {
      exerciseId: "bench_press",
      name: "Bench Press",
      sets: [
        { id: "quick-set-1", weight: 0, reps: 10, completed: false },
        { id: "quick-set-2", weight: 0, reps: 10, completed: false },
      ],
    },
  ];
  const exercises = hydrateSessionExercisesFromHistory(quickStartExercises, [
    olderSession,
    recentSession,
  ]);

  assert.equal(exercises[0]?.sets[0]?.weight, 82.5);
  assert.equal(exercises[0]?.sets[0]?.reps, 5);
  assert.equal(exercises[0]?.sets[0]?.previousWeight, 82.5);
  assert.equal(exercises[0]?.sets[0]?.previousReps, 5);
  assert.equal(exercises[0]?.sets[0]?.progressionHint, "Last: 82.5kg x 5");
});
