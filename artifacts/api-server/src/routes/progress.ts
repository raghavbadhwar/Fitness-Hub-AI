import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { requireAuth } from "@clerk/express";
import { and, eq } from "drizzle-orm";
import { db, memberProgressEntries, type MemberProgressEntry } from "@workspace/db";
import { requireApprovedAccess } from "../lib/user-access.ts";

const router = Router();
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const METRIC_KEYS = ["weight", "chest", "waist", "hips", "biceps", "thighs"] as const;

type ProgressMetricKey = (typeof METRIC_KEYS)[number];

router.use(requireAuth());

function isDateKey(value: unknown): value is string {
  return typeof value === "string" && DATE_RE.test(value);
}

function parseMetric(value: unknown): number | undefined {
  if (value === null || typeof value === "undefined" || value === "") {
    return undefined;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  return Math.round(parsed * 10) / 10;
}

function parseProgressPayload(body: unknown, options?: { requireDate?: boolean }) {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const date = record.date;
  if (options?.requireDate && !isDateKey(date)) {
    return null;
  }

  const metrics: Partial<Record<ProgressMetricKey, number>> = {};
  for (const key of METRIC_KEYS) {
    const value = parseMetric(record[key]);
    if (typeof value === "number") {
      metrics[key] = value;
    }
  }

  if (Object.keys(metrics).length === 0) {
    return null;
  }

  return {
    id: typeof record.id === "string" && record.id.trim() ? record.id.trim() : randomUUID(),
    date: isDateKey(date) ? date : null,
    metrics,
  };
}

function serializeProgressEntry(row: MemberProgressEntry) {
  return {
    id: row.id,
    date: row.date,
    weight: row.weight ?? undefined,
    chest: row.chest ?? undefined,
    waist: row.waist ?? undefined,
    hips: row.hips ?? undefined,
    biceps: row.biceps ?? undefined,
    thighs: row.thighs ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function requireProgressAccess(req: Request, res: Response) {
  return requireApprovedAccess(req, res, ["member", "trainer", "owner"]);
}

router.get("/entries", async (req: Request, res: Response) => {
  try {
    const access = await requireProgressAccess(req, res);
    if (!access) return;

    const rows = await db
      .select()
      .from(memberProgressEntries)
      .where(
        and(
          eq(memberProgressEntries.gymId, access.gymId),
          eq(memberProgressEntries.memberClerkId, access.userId),
        ),
      );

    res.json(
      rows.sort((left, right) => left.date.localeCompare(right.date)).map(serializeProgressEntry),
    );
  } catch (err) {
    req.log.error({ err }, "Failed to list progress entries");
    res.status(500).json({ error: "Failed to list progress entries" });
  }
});

router.post("/entries", async (req: Request, res: Response) => {
  try {
    const access = await requireProgressAccess(req, res);
    if (!access) return;

    const payload = parseProgressPayload(req.body, { requireDate: true });
    if (!payload || !payload.date) {
      res.status(400).json({ error: "date and at least one progress metric are required" });
      return;
    }

    const now = new Date();
    const [row] = await db
      .insert(memberProgressEntries)
      .values({
        id: payload.id,
        gymId: access.gymId,
        memberClerkId: access.userId,
        date: payload.date,
        ...payload.metrics,
      })
      .onConflictDoUpdate({
        target: [
          memberProgressEntries.gymId,
          memberProgressEntries.memberClerkId,
          memberProgressEntries.date,
        ],
        set: {
          ...payload.metrics,
          updatedAt: now,
        },
      })
      .returning();

    res.status(201).json(serializeProgressEntry(row));
  } catch (err) {
    req.log.error({ err }, "Failed to create progress entry");
    res.status(500).json({ error: "Failed to save progress entry" });
  }
});

router.patch("/entries/:id", async (req: Request, res: Response) => {
  try {
    const access = await requireProgressAccess(req, res);
    if (!access) return;

    const entryId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!entryId || !entryId.trim()) {
      res.status(400).json({ error: "Invalid progress entry id" });
      return;
    }

    const payload = parseProgressPayload(req.body);
    if (!payload) {
      res.status(400).json({ error: "At least one progress metric is required" });
      return;
    }

    const [row] = await db
      .update(memberProgressEntries)
      .set({
        ...(payload.date ? { date: payload.date } : {}),
        ...payload.metrics,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(memberProgressEntries.id, entryId),
          eq(memberProgressEntries.gymId, access.gymId),
          eq(memberProgressEntries.memberClerkId, access.userId),
        ),
      )
      .returning();

    if (!row) {
      res.status(404).json({ error: "Progress entry not found" });
      return;
    }

    res.json(serializeProgressEntry(row));
  } catch (err) {
    req.log.error({ err }, "Failed to update progress entry");
    res.status(500).json({ error: "Failed to update progress entry" });
  }
});

router.delete("/entries/:id", async (req: Request, res: Response) => {
  try {
    const access = await requireProgressAccess(req, res);
    if (!access) return;

    const entryId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!entryId || !entryId.trim()) {
      res.status(400).json({ error: "Invalid progress entry id" });
      return;
    }

    const deleted = await db
      .delete(memberProgressEntries)
      .where(
        and(
          eq(memberProgressEntries.id, entryId),
          eq(memberProgressEntries.gymId, access.gymId),
          eq(memberProgressEntries.memberClerkId, access.userId),
        ),
      )
      .returning({ id: memberProgressEntries.id });

    if (!deleted.length) {
      res.status(404).json({ error: "Progress entry not found" });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete progress entry");
    res.status(500).json({ error: "Failed to delete progress entry" });
  }
});

export default router;
