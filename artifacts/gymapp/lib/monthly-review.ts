import type { BodyMeasurement, UserProfile, WeightEntry } from "@/contexts/AppContext";
import type { DailyLog } from "@/contexts/NutritionContext";
import type { PersonalRecord, SavedWorkoutPlan, WorkoutSession } from "@/contexts/WorkoutContext";

export type MonthlyReviewStatus = "generated" | "reviewed";
export type MonthlyReviewTone = "success" | "warning" | "info" | "neutral";
export type MonthlyReviewSuggestionCategory =
  | "workout"
  | "nutrition"
  | "recovery"
  | "trainer"
  | "habit";
export type MonthlyReviewSuggestionPriority = "low" | "medium" | "high";
export type MonthlyReviewSuggestionSource = "deterministic" | "ai";

export interface MonthlyReviewMetrics {
  monthLabel: string;
  daysInMonth: number;
  elapsedDays: number;
  completedWorkouts: number;
  workoutDays: number;
  consistencyRate: number;
  totalVolume: number;
  totalDurationMinutes: number;
  caloriesBurned: number;
  prCount: number;
  bestLiftName: string | null;
  bestLiftWeight: number | null;
  nutritionLoggedDays: number;
  nutritionAdherenceRate: number;
  avgCalories: number;
  avgProtein: number;
  proteinAdherenceRate: number;
  waterLoggedDays: number;
  bodyWeightStart: number | null;
  bodyWeightEnd: number | null;
  weightDelta: number | null;
  bodyMeasurementsLogged: number;
  savedPlanCount: number;
  plansSavedThisMonth: number;
  risks: string[];
  momentum: "starting" | "building" | "strong";
}

export interface MonthlyReviewBadge {
  id: string;
  label: string;
  detail: string;
  tone: MonthlyReviewTone;
}

export interface MonthlyReviewSuggestedAdjustment {
  id: string;
  category: MonthlyReviewSuggestionCategory;
  title: string;
  detail: string;
  priority: MonthlyReviewSuggestionPriority;
  source: MonthlyReviewSuggestionSource;
}

export interface MonthlyReviewSnapshot {
  month: string;
  metrics: MonthlyReviewMetrics;
  badges: MonthlyReviewBadge[];
  suggestedAdjustments: MonthlyReviewSuggestedAdjustment[];
  dateKeys: string[];
  workoutDateKeys: string[];
  isCurrentMonth: boolean;
  isCompleteMonth: boolean;
}

export interface SavedMonthlyReview {
  id: string;
  gymId: string;
  memberClerkId: string;
  month: string;
  metrics: MonthlyReviewMetrics;
  badges: MonthlyReviewBadge[];
  aiSummary: string;
  coachNote: string;
  suggestedAdjustments: MonthlyReviewSuggestedAdjustment[];
  status: MonthlyReviewStatus;
  generatedAt: string;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyReviewResponse {
  review: SavedMonthlyReview | null;
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function parseMonth(month: string) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!match) {
    throw new Error("Month must use YYYY-MM format");
  }

  return { year: Number(match[1]), monthIndex: Number(match[2]) - 1 };
}

function isDateInRange(date: string, startDate: string, endDate: string) {
  return date >= startDate && date <= endDate;
}

function monthFromDateKey(dateKey: string) {
  return dateKey.slice(0, 7);
}

function estimateOneRepMax(record: PersonalRecord) {
  return record.weight * (1 + record.reps / 30);
}

function roundPercent(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

function roundNullable(value: number | null) {
  return value === null ? null : Math.round(value * 10) / 10;
}

export function getCurrentMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

export function shiftMonthKey(month: string, offset: number) {
  const { year, monthIndex } = parseMonth(month);
  const shifted = new Date(year, monthIndex + offset, 1);
  return `${shifted.getFullYear()}-${pad2(shifted.getMonth() + 1)}`;
}

export function formatMonthLabel(month: string) {
  const { year, monthIndex } = parseMonth(month);
  return new Date(year, monthIndex, 1).toLocaleDateString("en", {
    month: "long",
    year: "numeric",
  });
}

export function getMonthWindow(month: string, today = new Date()) {
  const { year, monthIndex } = parseMonth(month);
  const first = new Date(year, monthIndex, 1);
  const last = new Date(year, monthIndex + 1, 0);
  const currentMonth = getCurrentMonthKey(today);
  const isCurrentMonth = month === currentMonth;
  const isFutureMonth = month > currentMonth;
  const effectiveEnd = isFutureMonth ? first : isCurrentMonth ? today : last;
  const endDay = isFutureMonth ? 0 : Math.min(effectiveEnd.getDate(), last.getDate());

  return {
    startDate: `${year}-${pad2(monthIndex + 1)}-01`,
    endDate:
      endDay > 0
        ? `${year}-${pad2(monthIndex + 1)}-${pad2(endDay)}`
        : `${year}-${pad2(monthIndex + 1)}-00`,
    daysInMonth: last.getDate(),
    elapsedDays: endDay,
    isCurrentMonth,
    isCompleteMonth: !isCurrentMonth && !isFutureMonth,
  };
}

export function getMonthDateKeys(month: string, today = new Date()) {
  const { year, monthIndex } = parseMonth(month);
  const window = getMonthWindow(month, today);
  return Array.from({ length: window.elapsedDays }, (_, index) => {
    return `${year}-${pad2(monthIndex + 1)}-${pad2(index + 1)}`;
  });
}

function buildBadges(metrics: MonthlyReviewMetrics): MonthlyReviewBadge[] {
  const badges: MonthlyReviewBadge[] = [];

  if (metrics.completedWorkouts === 0 && metrics.nutritionLoggedDays === 0) {
    badges.push({
      id: "starting_point",
      label: "Starting Point",
      detail: "Baseline saved so next month has something real to beat.",
      tone: "info",
    });
  }

  if (metrics.completedWorkouts >= 12 || metrics.consistencyRate >= 45) {
    badges.push({
      id: "consistency_builder",
      label: "Consistency Builder",
      detail: `${metrics.workoutDays} training day${metrics.workoutDays === 1 ? "" : "s"} logged this month.`,
      tone: "success",
    });
  }

  if (metrics.prCount > 0) {
    badges.push({
      id: "strength_pr",
      label: "Strength PR",
      detail: `${metrics.prCount} personal record${metrics.prCount === 1 ? "" : "s"} captured.`,
      tone: "success",
    });
  }

  if (metrics.nutritionAdherenceRate >= 60 || metrics.proteinAdherenceRate >= 60) {
    badges.push({
      id: "nutrition_adherence",
      label: "Nutrition Adherence",
      detail: `${Math.max(metrics.nutritionAdherenceRate, metrics.proteinAdherenceRate)}% adherence on key nutrition targets.`,
      tone: "success",
    });
  } else if (metrics.nutritionLoggedDays >= Math.max(4, Math.ceil(metrics.elapsedDays * 0.35))) {
    badges.push({
      id: "logging_rhythm",
      label: "Logging Rhythm",
      detail: `${metrics.nutritionLoggedDays} nutrition day${metrics.nutritionLoggedDays === 1 ? "" : "s"} logged.`,
      tone: "info",
    });
  }

  if (metrics.plansSavedThisMonth > 0) {
    badges.push({
      id: "plan_builder",
      label: "Plan Builder",
      detail: `${metrics.plansSavedThisMonth} saved plan${metrics.plansSavedThisMonth === 1 ? "" : "s"} added or edited.`,
      tone: "info",
    });
  }

  if (metrics.weightDelta !== null && Math.abs(metrics.weightDelta) >= 0.5) {
    badges.push({
      id: "body_trend",
      label: "Body Trend",
      detail: `${metrics.weightDelta > 0 ? "+" : ""}${metrics.weightDelta} kg across logged weigh-ins.`,
      tone: "neutral",
    });
  }

  return badges.slice(0, 6);
}

function buildRisks(args: {
  metrics: Omit<MonthlyReviewMetrics, "risks" | "momentum">;
  profile: UserProfile;
}) {
  const risks: string[] = [];
  const { metrics, profile } = args;

  if (metrics.elapsedDays >= 7 && metrics.workoutDays <= 1) {
    risks.push("consistency drop");
  }
  if (
    metrics.elapsedDays >= 7 &&
    metrics.nutritionLoggedDays < Math.ceil(metrics.elapsedDays * 0.3)
  ) {
    risks.push("low nutrition logging");
  }
  if (metrics.completedWorkouts >= 8 && metrics.prCount === 0) {
    risks.push("stalled PRs");
  }
  if (
    metrics.completedWorkouts >= 10 &&
    metrics.totalDurationMinutes / metrics.completedWorkouts > 85
  ) {
    risks.push("high fatigue pattern");
  }
  if (profile.injuries.includes("lower_back")) {
    risks.push("lower-back limitation");
  }

  return risks;
}

function buildSuggestions(args: {
  metrics: MonthlyReviewMetrics;
  profile: UserProfile;
}): MonthlyReviewSuggestedAdjustment[] {
  const suggestions: MonthlyReviewSuggestedAdjustment[] = [];
  const { metrics, profile } = args;

  if (metrics.workoutDays <= 1 || metrics.consistencyRate < 25) {
    suggestions.push({
      id: "two_fixed_training_days",
      category: "workout",
      title: "Anchor two fixed training days",
      detail: "Repeat one full-body plan twice weekly before adding extra exercises.",
      priority: "high",
      source: "deterministic",
    });
  } else if (
    metrics.completedWorkouts >= 10 &&
    metrics.totalDurationMinutes / metrics.completedWorkouts > 85
  ) {
    suggestions.push({
      id: "reduce_volume_next_week",
      category: "recovery",
      title: "Reduce next week's volume by 10%",
      detail: "Keep the same exercises but remove one working set from the longest session.",
      priority: "medium",
      source: "deterministic",
    });
  } else if (metrics.completedWorkouts >= 6 && metrics.prCount === 0) {
    suggestions.push({
      id: "repeat_push_day",
      category: "workout",
      title: "Repeat Push Day twice weekly",
      detail: "Use the same main lift twice weekly for two weeks so progression is measurable.",
      priority: "medium",
      source: "deterministic",
    });
  }

  if (metrics.nutritionLoggedDays < Math.ceil(Math.max(metrics.elapsedDays, 1) * 0.4)) {
    suggestions.push({
      id: "protein_first_logging",
      category: "nutrition",
      title: "Increase protein consistency",
      detail: "Log protein at breakfast and dinner for 10 days before changing calorie targets.",
      priority: "medium",
      source: "deterministic",
    });
  } else if (metrics.proteinAdherenceRate < 60) {
    suggestions.push({
      id: "planned_protein_meal",
      category: "nutrition",
      title: "Add one planned protein meal",
      detail: "Add a repeatable 30g protein meal on training days and review adherence next week.",
      priority: "medium",
      source: "deterministic",
    });
  }

  if (profile.injuries.includes("lower_back")) {
    suggestions.push({
      id: "lower_back_check",
      category: "trainer",
      title: "Trainer should check lower-back limitation",
      detail: "Review loaded hinges, squats, and bracing before increasing lower-body load.",
      priority: "high",
      source: "deterministic",
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      id: "protect_current_rhythm",
      category: "habit",
      title: "Protect the current rhythm",
      detail:
        "Keep the same weekly workout structure next week and make only one small nutrition change.",
      priority: "low",
      source: "deterministic",
    });
  }

  return suggestions.slice(0, 4);
}

export function buildMonthlyReviewSnapshot(args: {
  month: string;
  today?: Date;
  profile: UserProfile;
  nutritionLogs: DailyLog[];
  sessions: WorkoutSession[];
  personalRecords: PersonalRecord[];
  savedPlans: SavedWorkoutPlan[];
  weightLog: WeightEntry[];
  bodyMeasurements: BodyMeasurement[];
}): MonthlyReviewSnapshot {
  const today = args.today ?? new Date();
  const window = getMonthWindow(args.month, today);
  const dateKeys = getMonthDateKeys(args.month, today);
  const rangeStart = window.startDate;
  const rangeEnd = window.endDate;
  const completedSessions = args.sessions.filter(
    (session) => session.completed && isDateInRange(session.date, rangeStart, rangeEnd),
  );
  const workoutDateKeys = [...new Set(completedSessions.map((session) => session.date))].sort();
  const totalVolume = completedSessions.reduce((sum, session) => sum + session.totalVolume, 0);
  const totalDurationMinutes = completedSessions.reduce(
    (sum, session) => sum + (session.duration ?? 0),
    0,
  );
  const caloriesBurned = completedSessions.reduce(
    (sum, session) => sum + session.caloriesBurned,
    0,
  );
  const prsInMonth = args.personalRecords.filter((record) =>
    isDateInRange(record.date, rangeStart, rangeEnd),
  );
  const bestLift = prsInMonth
    .slice()
    .sort((left, right) => estimateOneRepMax(right) - estimateOneRepMax(left))[0];

  const nutritionLogs = args.nutritionLogs.filter((log) =>
    isDateInRange(log.date, rangeStart, rangeEnd),
  );
  const loggedNutritionDays = nutritionLogs.filter(
    (log) => log.entries.length > 0 || log.waterIntake > 0,
  );
  const nutritionTotals = loggedNutritionDays.reduce(
    (acc, log) => {
      const entryTotals = log.entries.reduce(
        (entryAcc, entry) => ({
          calories: entryAcc.calories + entry.calories,
          protein: entryAcc.protein + entry.protein,
        }),
        { calories: 0, protein: 0 },
      );

      return {
        calories: acc.calories + entryTotals.calories,
        protein: acc.protein + entryTotals.protein,
      };
    },
    { calories: 0, protein: 0 },
  );
  const calorieAdherenceDays = loggedNutritionDays.filter((log) => {
    const calories = log.entries.reduce((sum, entry) => sum + entry.calories, 0);
    if (args.profile.dailyCalorieTarget <= 0) return false;
    return (
      Math.abs(calories - args.profile.dailyCalorieTarget) / args.profile.dailyCalorieTarget <= 0.18
    );
  }).length;
  const proteinAdherenceDays = loggedNutritionDays.filter((log) => {
    const protein = log.entries.reduce((sum, entry) => sum + entry.protein, 0);
    return args.profile.dailyProteinTarget > 0 && protein >= args.profile.dailyProteinTarget * 0.8;
  }).length;
  const waterLoggedDays = loggedNutritionDays.filter((log) => log.waterIntake > 0).length;

  const weightsInMonth = args.weightLog
    .filter((entry) => isDateInRange(entry.date, rangeStart, rangeEnd))
    .sort((left, right) => left.date.localeCompare(right.date));
  const bodyWeightStart = weightsInMonth[0]?.weight ?? null;
  const bodyWeightEnd = weightsInMonth[weightsInMonth.length - 1]?.weight ?? null;
  const weightDelta =
    bodyWeightStart !== null && bodyWeightEnd !== null ? bodyWeightEnd - bodyWeightStart : null;
  const bodyMeasurementsLogged = args.bodyMeasurements.filter((entry) =>
    isDateInRange(entry.date, rangeStart, rangeEnd),
  ).length;
  const plansSavedThisMonth = args.savedPlans.filter(
    (plan) => monthFromDateKey(plan.updatedAt.slice(0, 10)) === args.month,
  ).length;

  const metricsBase = {
    monthLabel: formatMonthLabel(args.month),
    daysInMonth: window.daysInMonth,
    elapsedDays: window.elapsedDays,
    completedWorkouts: completedSessions.length,
    workoutDays: workoutDateKeys.length,
    consistencyRate: roundPercent(workoutDateKeys.length, Math.max(window.elapsedDays, 1)),
    totalVolume: Math.round(totalVolume),
    totalDurationMinutes: Math.round(totalDurationMinutes),
    caloriesBurned: Math.round(caloriesBurned),
    prCount: prsInMonth.length,
    bestLiftName: bestLift?.name ?? null,
    bestLiftWeight: bestLift?.weight ?? null,
    nutritionLoggedDays: loggedNutritionDays.length,
    nutritionAdherenceRate: roundPercent(calorieAdherenceDays, Math.max(window.elapsedDays, 1)),
    avgCalories: loggedNutritionDays.length
      ? Math.round(nutritionTotals.calories / loggedNutritionDays.length)
      : 0,
    avgProtein: loggedNutritionDays.length
      ? Math.round(nutritionTotals.protein / loggedNutritionDays.length)
      : 0,
    proteinAdherenceRate: roundPercent(proteinAdherenceDays, Math.max(window.elapsedDays, 1)),
    waterLoggedDays,
    bodyWeightStart,
    bodyWeightEnd,
    weightDelta: roundNullable(weightDelta),
    bodyMeasurementsLogged,
    savedPlanCount: args.savedPlans.length,
    plansSavedThisMonth,
  };

  const risks = buildRisks({ metrics: metricsBase, profile: args.profile });
  const momentum =
    metricsBase.completedWorkouts >= 10 && risks.length <= 1
      ? "strong"
      : metricsBase.completedWorkouts >= 3 || metricsBase.nutritionLoggedDays >= 5
        ? "building"
        : "starting";
  const metrics: MonthlyReviewMetrics = { ...metricsBase, risks, momentum };

  return {
    month: args.month,
    metrics,
    badges: buildBadges(metrics),
    suggestedAdjustments: buildSuggestions({ metrics, profile: args.profile }),
    dateKeys,
    workoutDateKeys,
    isCurrentMonth: window.isCurrentMonth,
    isCompleteMonth: window.isCompleteMonth,
  };
}
