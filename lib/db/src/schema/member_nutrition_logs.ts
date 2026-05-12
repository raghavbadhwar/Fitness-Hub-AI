import { integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export interface MemberNutritionEntry {
  id: string;
  foodId: string;
  name: string;
  mealType: string;
  servings: number;
  servingSize: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  timestamp: number;
  fromPhoto?: boolean;
  photoUri?: string;
  source?: "manual" | "photo" | "search" | "recent" | "barcode" | "label";
  confidence?: "high" | "medium" | "low";
  ingredients?: string[];
  servingGrams?: number;
  barcode?: string;
  correctionOf?: string;
  correctedAt?: number;
  relogOf?: string;
  notes?: string;
}

export const memberNutritionLogs = pgTable(
  "member_nutrition_logs",
  {
    id: text("id").primaryKey(),
    gymId: text("gym_id").notNull().default("gymos-main"),
    memberClerkId: text("member_clerk_id").notNull(),
    date: text("date").notNull(),
    entries: jsonb("entries").notNull().default([]).$type<MemberNutritionEntry[]>(),
    waterIntake: integer("water_intake").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("member_nutrition_logs_gym_member_date_idx").on(
      table.gymId,
      table.memberClerkId,
      table.date,
    ),
  ],
);

export type MemberNutritionLog = typeof memberNutritionLogs.$inferSelect;
