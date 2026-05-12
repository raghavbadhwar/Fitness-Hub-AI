import type { ExerciseSet, WorkoutExercise, WorkoutSession } from "../contexts/WorkoutContext";

export type PreviousSetSnapshot = Pick<ExerciseSet, "weight" | "reps" | "type" | "rpe" | "rir">;

export type PreviousExerciseSetLookup = Record<string, PreviousSetSnapshot[]>;

export interface ExerciseHistorySummary {
  lastPerformedAt: number;
  lastSets: PreviousSetSnapshot[];
  bestEstimatedOneRepMax: number;
}

function getCompletedAt(session: WorkoutSession): number {
  return session.endTime ?? session.startTime;
}

function toPreviousSnapshot(set: ExerciseSet): PreviousSetSnapshot {
  return {
    weight: set.weight,
    reps: set.reps,
    ...(set.type ? { type: set.type } : {}),
    ...(typeof set.rpe === "number" ? { rpe: set.rpe } : {}),
    ...(typeof set.rir === "number" ? { rir: set.rir } : {}),
  };
}

export function buildPreviousExerciseSetLookup(
  sessions: WorkoutSession[],
): PreviousExerciseSetLookup {
  const lookup: PreviousExerciseSetLookup = {};
  const completedSessions = sessions
    .filter((session) => session.completed)
    .slice()
    .sort((left, right) => getCompletedAt(right) - getCompletedAt(left));

  for (const session of completedSessions) {
    for (const exercise of session.exercises) {
      if (lookup[exercise.exerciseId]) continue;

      const previousSets = exercise.sets
        .filter((set) => set.completed && (set.weight > 0 || set.reps > 0))
        .map(toPreviousSnapshot);

      if (previousSets.length > 0) {
        lookup[exercise.exerciseId] = previousSets;
      }
    }
  }

  return lookup;
}

function estimateOneRepMax(weight: number, reps: number): number {
  return Math.round(weight * (1 + reps / 30));
}

function getProgressionHint(previousSet: PreviousSetSnapshot): string {
  if (previousSet.weight <= 0 || previousSet.reps <= 0) {
    return "Repeat last logged effort";
  }

  return `Last: ${previousSet.weight}kg x ${previousSet.reps}`;
}

export function buildExerciseHistorySummary(
  sessions: WorkoutSession[],
  exerciseId: string,
): ExerciseHistorySummary | null {
  const completedSessions = sessions
    .filter((session) => session.completed)
    .slice()
    .sort((left, right) => getCompletedAt(right) - getCompletedAt(left));

  let bestEstimatedOneRepMax = 0;
  let lastPerformedAt = 0;
  let lastSets: PreviousSetSnapshot[] = [];

  for (const session of completedSessions) {
    const exercise = session.exercises.find((entry) => entry.exerciseId === exerciseId);
    if (!exercise) continue;

    const completedSets = exercise.sets.filter(
      (set) => set.completed && (set.weight > 0 || set.reps > 0),
    );

    for (const set of completedSets) {
      bestEstimatedOneRepMax = Math.max(
        bestEstimatedOneRepMax,
        estimateOneRepMax(set.weight, set.reps),
      );
    }

    if (!lastPerformedAt && completedSets.length) {
      lastPerformedAt = getCompletedAt(session);
      lastSets = completedSets.map(toPreviousSnapshot);
    }
  }

  if (!lastPerformedAt) return null;

  return {
    lastPerformedAt,
    lastSets,
    bestEstimatedOneRepMax,
  };
}

export function hydrateExercisesWithPreviousSets<T extends Omit<WorkoutExercise, "id">>(
  exercises: T[],
  lookup: PreviousExerciseSetLookup,
): T[] {
  return exercises.map((exercise) => {
    const previousSets = lookup[exercise.exerciseId];
    if (!previousSets?.length) return exercise;

    return {
      ...exercise,
      sets: exercise.sets.map((set, index) => {
        if (set.completed) return set;
        const previousSet = previousSets[index];
        if (!previousSet) return set;

        return {
          ...set,
          weight: previousSet.weight > 0 ? previousSet.weight : set.weight,
          reps: previousSet.reps > 0 ? previousSet.reps : set.reps,
          previousWeight: previousSet.weight,
          previousReps: previousSet.reps,
          progressionHint: getProgressionHint(previousSet),
          type: set.type ?? "normal",
        };
      }),
    };
  });
}

export function hydrateSessionExercisesFromHistory<T extends Omit<WorkoutExercise, "id">>(
  exercises: T[],
  sessions: WorkoutSession[],
): T[] {
  return hydrateExercisesWithPreviousSets(exercises, buildPreviousExerciseSetLookup(sessions));
}
