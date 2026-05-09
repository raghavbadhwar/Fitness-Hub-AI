const INJURY_EXERCISE_CONFLICTS: Record<string, RegExp> = {
  lower_back: /\b(deadlift|good morning|back squat|barbell row)\b/i,
  knee: /\b(jump squat|box jump|pistol squat|deep lunge)\b/i,
  shoulder: /\b(behind[- ]the[- ]neck|upright row|overhead press)\b/i,
  wrist: /\b(barbell curl|push-up|pushup|front rack)\b/i,
};

export function scoreWorkoutSuggestionQuality(
  suggestion: unknown,
  constraints: { availableTime?: number; injuries?: string[] } = {},
) {
  const issues: string[] = [];
  const workout = suggestion as {
    duration?: unknown;
    exercises?: Array<{ name?: unknown }>;
    warmup?: unknown;
    cooldown?: unknown;
  };

  if (!Array.isArray(workout.exercises) || workout.exercises.length < 3) {
    issues.push("workout needs at least three exercises");
  }

  if (typeof workout.duration !== "number" || workout.duration < 5) {
    issues.push("workout duration must be a positive number");
  } else if (constraints.availableTime && workout.duration > constraints.availableTime + 15) {
    issues.push("workout duration exceeds the requested window");
  }

  if (typeof workout.warmup !== "string" || !workout.warmup.trim()) {
    issues.push("workout needs a warmup");
  }
  if (typeof workout.cooldown !== "string" || !workout.cooldown.trim()) {
    issues.push("workout needs a cooldown");
  }

  const exerciseText = Array.isArray(workout.exercises)
    ? workout.exercises.map((exercise) => String(exercise?.name ?? "")).join(" ")
    : "";
  for (const injury of constraints.injuries ?? []) {
    const pattern = INJURY_EXERCISE_CONFLICTS[injury];
    if (pattern?.test(exerciseText)) {
      issues.push(`workout conflicts with ${injury} constraint`);
    }
  }

  return { ok: issues.length === 0, issues };
}

export function scoreFoodAnalysisQuality(analysis: unknown) {
  const issues: string[] = [];
  const food = analysis as {
    calories?: unknown;
    protein?: unknown;
    carbs?: unknown;
    fat?: unknown;
    fiber?: unknown;
    confidence?: unknown;
    ingredients?: unknown;
  };

  const ranges = [
    ["calories", food.calories, 0, 2500],
    ["protein", food.protein, 0, 250],
    ["carbs", food.carbs, 0, 400],
    ["fat", food.fat, 0, 250],
    ["fiber", food.fiber, 0, 100],
  ] as const;

  for (const [field, value, min, max] of ranges) {
    if (typeof value !== "number" || value < min || value > max) {
      issues.push(`${field} is outside expected range`);
    }
  }

  if (!["low", "medium", "high"].includes(String(food.confidence))) {
    issues.push("confidence must be low, medium, or high");
  }
  if (!Array.isArray(food.ingredients) || food.ingredients.length === 0) {
    issues.push("ingredients must be non-empty");
  }

  return { ok: issues.length === 0, issues };
}
