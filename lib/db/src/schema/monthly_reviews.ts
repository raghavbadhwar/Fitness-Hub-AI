import { jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

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
  monthLabel?: string;
  daysInMonth?: number;
  elapsedDays?: number;
  completedWorkouts?: number;
  workoutDays?: number;
  consistencyRate?: number;
  totalVolume?: number;
  totalDurationMinutes?: number;
  caloriesBurned?: number;
  prCount?: number;
  bestLiftName?: string | null;
  bestLiftWeight?: number | null;
  nutritionLoggedDays?: number;
  nutritionAdherenceRate?: number;
  avgCalories?: number;
  avgProtein?: number;
  proteinAdherenceRate?: number;
  waterLoggedDays?: number;
  bodyWeightStart?: number | null;
  bodyWeightEnd?: number | null;
  weightDelta?: number | null;
  bodyMeasurementsLogged?: number;
  savedPlanCount?: number;
  plansSavedThisMonth?: number;
  risks?: string[];
  momentum?: "starting" | "building" | "strong";
  [key: string]: unknown;
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

export const monthlyReviews = pgTable(
  "monthly_reviews",
  {
    id: text("id").primaryKey(),
    gymId: text("gym_id").notNull().default("gymos-main"),
    memberClerkId: text("member_clerk_id").notNull(),
    month: text("month").notNull(),
    metrics: jsonb("metrics").notNull().default({}).$type<MonthlyReviewMetrics>(),
    badges: jsonb("badges").notNull().default([]).$type<MonthlyReviewBadge[]>(),
    aiSummary: text("ai_summary").notNull().default(""),
    coachNote: text("coach_note").notNull().default(""),
    suggestedAdjustments: jsonb("suggested_adjustments")
      .notNull()
      .default([])
      .$type<MonthlyReviewSuggestedAdjustment[]>(),
    status: text("status").notNull().default("generated").$type<MonthlyReviewStatus>(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("monthly_reviews_gym_member_month_idx").on(
      table.gymId,
      table.memberClerkId,
      table.month,
    ),
  ],
);

export type MonthlyReview = typeof monthlyReviews.$inferSelect;
