import { doublePrecision, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const memberProgressEntries = pgTable(
  "member_progress_entries",
  {
    id: text("id").primaryKey(),
    gymId: text("gym_id").notNull().default("gymos-main"),
    memberClerkId: text("member_clerk_id").notNull(),
    date: text("date").notNull(),
    weight: doublePrecision("weight"),
    chest: doublePrecision("chest"),
    waist: doublePrecision("waist"),
    hips: doublePrecision("hips"),
    biceps: doublePrecision("biceps"),
    thighs: doublePrecision("thighs"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("member_progress_entries_gym_member_date_idx").on(
      table.gymId,
      table.memberClerkId,
      table.date,
    ),
  ],
);

export type MemberProgressEntry = typeof memberProgressEntries.$inferSelect;
