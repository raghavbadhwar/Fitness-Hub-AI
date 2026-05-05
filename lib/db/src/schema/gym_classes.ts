import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export type ClassAttendanceStatus = "booked" | "checked_in" | "no_show";

export type ClassAttendanceRecord = {
  memberId: string;
  status: ClassAttendanceStatus;
  updatedAt: string;
  updatedBy: string | null;
};

export const gymClassesTable = pgTable("gym_classes", {
  id: serial("id").primaryKey(),
  gymId: text("gym_id").notNull().default("gymos-main"),
  name: text("name").notNull(),
  category: text("category").notNull().default("Other"),
  description: text("description").notNull().default(""),
  trainer: text("trainer").notNull(),
  date: text("date").notNull(),
  startTime: text("start_time").notNull(),
  duration: integer("duration").notNull(),
  maxParticipants: integer("max_participants").notNull(),
  enrolledCount: integer("enrolled_count").notNull().default(0),
  enrolledMemberIds: jsonb("enrolled_member_ids").notNull().default([]).$type<string[]>(),
  waitlistedMemberIds: jsonb("waitlisted_member_ids").notNull().default([]).$type<string[]>(),
  attendanceRecords: jsonb("attendance_records")
    .notNull()
    .default([])
    .$type<ClassAttendanceRecord[]>(),
  room: text("room").notNull(),
  status: text("status").notNull().default("scheduled"),
  color: text("color").notNull().default("#9096B3"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertGymClassSchema = createInsertSchema(gymClassesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type GymClassRow = typeof gymClassesTable.$inferSelect;
export type InsertGymClass = z.infer<typeof insertGymClassSchema>;
