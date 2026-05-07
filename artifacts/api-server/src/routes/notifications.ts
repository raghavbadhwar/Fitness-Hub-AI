import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { requireAuth } from "@clerk/express";
import { and, eq } from "drizzle-orm";
import {
  db,
  memberNotificationPreferences,
  type MemberNotificationPreference,
} from "@workspace/db";
import { requireApprovedAccess } from "../lib/user-access.ts";

const router = Router();

router.use(requireAuth());

const DEFAULT_NOTIFICATION_PREFERENCES = {
  classRemindersEnabled: true,
  workoutRemindersEnabled: true,
  reminderLeadMinutes: 60,
  emailEnabled: true,
  pushEnabled: false,
};

function serializeNotificationPreference(row: MemberNotificationPreference | null) {
  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...(row
      ? {
          classRemindersEnabled: row.classRemindersEnabled,
          workoutRemindersEnabled: row.workoutRemindersEnabled,
          reminderLeadMinutes: row.reminderLeadMinutes,
          emailEnabled: row.emailEnabled,
          pushEnabled: row.pushEnabled,
          updatedAt: row.updatedAt.toISOString(),
        }
      : {}),
  };
}

function parseNotificationPreferencePayload(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const reminderLeadMinutes =
    typeof record.reminderLeadMinutes === "number" && Number.isFinite(record.reminderLeadMinutes)
      ? Math.max(5, Math.min(1440, Math.round(record.reminderLeadMinutes)))
      : DEFAULT_NOTIFICATION_PREFERENCES.reminderLeadMinutes;

  return {
    classRemindersEnabled:
      typeof record.classRemindersEnabled === "boolean"
        ? record.classRemindersEnabled
        : DEFAULT_NOTIFICATION_PREFERENCES.classRemindersEnabled,
    workoutRemindersEnabled:
      typeof record.workoutRemindersEnabled === "boolean"
        ? record.workoutRemindersEnabled
        : DEFAULT_NOTIFICATION_PREFERENCES.workoutRemindersEnabled,
    reminderLeadMinutes,
    emailEnabled:
      typeof record.emailEnabled === "boolean"
        ? record.emailEnabled
        : DEFAULT_NOTIFICATION_PREFERENCES.emailEnabled,
    pushEnabled:
      typeof record.pushEnabled === "boolean"
        ? record.pushEnabled
        : DEFAULT_NOTIFICATION_PREFERENCES.pushEnabled,
  };
}

async function requireNotificationAccess(req: Request, res: Response) {
  return requireApprovedAccess(req, res, ["member", "trainer", "owner"]);
}

router.get("/preferences", async (req: Request, res: Response) => {
  try {
    const access = await requireNotificationAccess(req, res);
    if (!access) return;

    const [row] = await db
      .select()
      .from(memberNotificationPreferences)
      .where(
        and(
          eq(memberNotificationPreferences.gymId, access.gymId),
          eq(memberNotificationPreferences.memberClerkId, access.userId),
        ),
      )
      .limit(1);

    res.json(serializeNotificationPreference(row ?? null));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch notification preferences");
    res.status(500).json({ error: "Failed to fetch notification preferences" });
  }
});

router.put("/preferences", async (req: Request, res: Response) => {
  try {
    const access = await requireNotificationAccess(req, res);
    if (!access) return;

    const payload = parseNotificationPreferencePayload(req.body);
    if (!payload) {
      res.status(400).json({ error: "Invalid notification preferences" });
      return;
    }

    const [row] = await db
      .insert(memberNotificationPreferences)
      .values({
        id: randomUUID(),
        gymId: access.gymId,
        memberClerkId: access.userId,
        ...payload,
      })
      .onConflictDoUpdate({
        target: [memberNotificationPreferences.gymId, memberNotificationPreferences.memberClerkId],
        set: {
          ...payload,
          updatedAt: new Date(),
        },
      })
      .returning();

    res.json(serializeNotificationPreference(row));
  } catch (err) {
    req.log.error({ err }, "Failed to update notification preferences");
    res.status(500).json({ error: "Failed to update notification preferences" });
  }
});

export default router;
