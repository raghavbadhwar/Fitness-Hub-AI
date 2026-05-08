import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { and, eq } from "drizzle-orm";
import { db, memberNutritionLogs, type MemberNutritionEntry } from "@workspace/db";
import { requireApiAuth } from "../middlewares/apiAuth.ts";
import { requireApprovedAccess } from "../lib/user-access.ts";

const router = Router();
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

router.use(requireApiAuth);

function isDateKey(value: unknown): value is string {
  return typeof value === "string" && DATE_RE.test(value);
}

function normalizeEntries(value: unknown): MemberNutritionEntry[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  return value.map((entry) => ({
    ...(entry as Record<string, unknown>),
  })) as unknown as MemberNutritionEntry[];
}

function serializeNutritionLog(row: typeof memberNutritionLogs.$inferSelect) {
  return {
    id: row.id,
    date: row.date,
    entries: row.entries,
    waterIntake: row.waterIntake,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function requireNutritionAccess(req: Request, res: Response) {
  return requireApprovedAccess(req, res, ["member", "trainer", "owner"]);
}

async function listMemberNutritionRows(gymId: string, userId: string) {
  return db
    .select()
    .from(memberNutritionLogs)
    .where(
      and(eq(memberNutritionLogs.gymId, gymId), eq(memberNutritionLogs.memberClerkId, userId)),
    );
}

router.get("/logs", async (req: Request, res: Response) => {
  try {
    const access = await requireNutritionAccess(req, res);
    if (!access) return;

    const from = Array.isArray(req.query.from) ? req.query.from[0] : req.query.from;
    const to = Array.isArray(req.query.to) ? req.query.to[0] : req.query.to;
    if ((from !== undefined && !isDateKey(from)) || (to !== undefined && !isDateKey(to))) {
      res.status(400).json({ error: "from and to must be YYYY-MM-DD" });
      return;
    }

    const rows = await listMemberNutritionRows(access.gymId, access.userId);
    res.json(
      rows
        .filter((row) => (from ? row.date >= from : true) && (to ? row.date <= to : true))
        .sort((left, right) => left.date.localeCompare(right.date))
        .map(serializeNutritionLog),
    );
  } catch (err) {
    req.log.error({ err }, "Failed to list nutrition logs");
    res.status(500).json({ error: "Failed to list nutrition logs" });
  }
});

router.get("/logs/:date", async (req: Request, res: Response) => {
  try {
    const access = await requireNutritionAccess(req, res);
    if (!access) return;

    const date = Array.isArray(req.params.date) ? req.params.date[0] : req.params.date;
    if (!isDateKey(date)) {
      res.status(400).json({ error: "date must be YYYY-MM-DD" });
      return;
    }

    const [row] = await db
      .select()
      .from(memberNutritionLogs)
      .where(
        and(
          eq(memberNutritionLogs.gymId, access.gymId),
          eq(memberNutritionLogs.memberClerkId, access.userId),
          eq(memberNutritionLogs.date, date),
        ),
      )
      .limit(1);

    if (!row) {
      res.json({ date, entries: [], waterIntake: 0 });
      return;
    }

    res.json(serializeNutritionLog(row));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch nutrition log");
    res.status(500).json({ error: "Failed to fetch nutrition log" });
  }
});

router.put("/logs/:date", async (req: Request, res: Response) => {
  try {
    const access = await requireNutritionAccess(req, res);
    if (!access) return;

    const date = Array.isArray(req.params.date) ? req.params.date[0] : req.params.date;
    if (!isDateKey(date)) {
      res.status(400).json({ error: "date must be YYYY-MM-DD" });
      return;
    }

    const entries = normalizeEntries((req.body ?? {}).entries);
    const waterIntake = (req.body ?? {}).waterIntake;
    if (!entries || typeof waterIntake !== "number" || !Number.isFinite(waterIntake)) {
      res.status(400).json({ error: "entries array and numeric waterIntake are required" });
      return;
    }

    const now = new Date();
    const [row] = await db
      .insert(memberNutritionLogs)
      .values({
        id: randomUUID(),
        gymId: access.gymId,
        memberClerkId: access.userId,
        date,
        entries,
        waterIntake: Math.max(0, Math.round(waterIntake)),
      })
      .onConflictDoUpdate({
        target: [
          memberNutritionLogs.gymId,
          memberNutritionLogs.memberClerkId,
          memberNutritionLogs.date,
        ],
        set: {
          entries,
          waterIntake: Math.max(0, Math.round(waterIntake)),
          updatedAt: now,
        },
      })
      .returning();

    res.json(serializeNutritionLog(row));
  } catch (err) {
    req.log.error({ err }, "Failed to upsert nutrition log");
    res.status(500).json({ error: "Failed to save nutrition log" });
  }
});

export default router;
