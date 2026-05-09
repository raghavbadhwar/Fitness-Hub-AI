import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { db } from "@workspace/db";
import {
  memberPersonalRecords,
  memberWorkoutSessions,
  memberWorkoutPlans,
  workoutAssignments,
  workoutTemplates,
  type MemberPersonalRecord,
  type MemberWorkoutSession,
  type MemberWorkoutSessionExercise,
  type MemberWorkoutSessionSet,
  type MemberWorkoutPlanExercise,
} from "@workspace/db/schema";
import { userProfiles, type TemplateExercise } from "@workspace/db";
import { eq, and, isNull, desc } from "drizzle-orm";
import { requireApiAuth } from "../middlewares/apiAuth.ts";
import { requireApprovedAccess } from "../lib/user-access.ts";
import { listAllClerkUsers } from "../lib/clerk-request.ts";
import { readObjectBody } from "../lib/request-validation.ts";

const router = Router();

router.use(requireApiAuth);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface NormalizedWorkoutSession {
  id: string;
  name: string;
  date: string;
  startTime: Date;
  endTime: Date | null;
  duration: number | null;
  exercises: MemberWorkoutSessionExercise[];
  notes: string | null;
  totalVolume: number;
  caloriesBurned: number;
  completed: boolean;
  aiGenerated: boolean;
}

function parsePlanExercises(exercises: unknown): MemberWorkoutPlanExercise[] | null {
  if (!Array.isArray(exercises) || exercises.length === 0) {
    return null;
  }

  const parsed: MemberWorkoutPlanExercise[] = [];
  for (const exercise of exercises) {
    if (!exercise || typeof exercise !== "object") continue;
    const record = exercise as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name.trim() : "";
    if (!name) continue;

    parsed.push({
      exerciseId:
        typeof record.exerciseId === "string" ? record.exerciseId : String(record.exerciseId ?? ""),
      name,
      sets:
        typeof record.sets === "number"
          ? Math.max(1, Math.round(record.sets))
          : Math.max(1, parseInt(String(record.sets ?? 1), 10) || 1),
      reps:
        typeof record.reps === "number"
          ? Math.max(1, Math.round(record.reps))
          : Math.max(1, parseInt(String(record.reps ?? 1), 10) || 1),
      notes:
        typeof record.notes === "string" && record.notes.trim() ? record.notes.trim() : undefined,
    });
  }

  return parsed.length ? parsed : null;
}

function serializeMemberWorkoutPlan(plan: typeof memberWorkoutPlans.$inferSelect) {
  return {
    ...plan,
    source: "member" as const,
  };
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asNonNegativeInteger(value: unknown, fallback = 0): number {
  const parsed = asFiniteNumber(value);
  return parsed === null ? fallback : Math.max(0, Math.round(parsed));
}

function asDateFromEpoch(value: unknown): Date | null {
  const parsed = asFiniteNumber(value);
  if (parsed === null || parsed <= 0) return null;
  const date = new Date(parsed);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseWorkoutSets(value: unknown): MemberWorkoutSessionSet[] | null {
  if (!Array.isArray(value)) return null;

  const parsed: MemberWorkoutSessionSet[] = [];
  for (const set of value) {
    if (!set || typeof set !== "object") continue;
    const record = set as Record<string, unknown>;
    const id = typeof record.id === "string" && record.id.trim() ? record.id.trim() : randomUUID();
    const reps = asNonNegativeInteger(record.reps, 0);
    const weight = asNonNegativeInteger(record.weight, 0);
    parsed.push({
      id,
      weight,
      reps,
      completed: Boolean(record.completed),
    });
  }

  return parsed.length ? parsed : null;
}

function parseWorkoutExercises(value: unknown): MemberWorkoutSessionExercise[] | null {
  if (!Array.isArray(value)) return null;

  const parsed: MemberWorkoutSessionExercise[] = [];
  for (const exercise of value) {
    if (!exercise || typeof exercise !== "object") continue;
    const record = exercise as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name.trim() : "";
    if (!name) continue;
    const sets = parseWorkoutSets(record.sets);
    if (!sets) continue;

    parsed.push({
      id: typeof record.id === "string" && record.id.trim() ? record.id.trim() : randomUUID(),
      exerciseId:
        typeof record.exerciseId === "string" && record.exerciseId.trim()
          ? record.exerciseId.trim()
          : name,
      name,
      sets,
      ...(typeof record.notes === "string" && record.notes.trim()
        ? { notes: record.notes.trim() }
        : {}),
    });
  }

  return parsed.length ? parsed : null;
}

function parseWorkoutSessionPayload(
  payload: unknown,
  fallback?: MemberWorkoutSession,
): NormalizedWorkoutSession | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const id =
    typeof record.id === "string" && record.id.trim()
      ? record.id.trim()
      : (fallback?.id ?? randomUUID());
  const name =
    typeof record.name === "string" && record.name.trim()
      ? record.name.trim()
      : (fallback?.name ?? "");
  const date =
    typeof record.date === "string" && DATE_RE.test(record.date) ? record.date : fallback?.date;
  const startTime = asDateFromEpoch(record.startTime) ?? fallback?.startTime;
  const endTime =
    record.endTime === null ? null : (asDateFromEpoch(record.endTime) ?? fallback?.endTime ?? null);
  const exercises = parseWorkoutExercises(record.exercises) ?? fallback?.exercises;

  if (!id || !name || !date || !startTime || !exercises) {
    return null;
  }

  return {
    id,
    name,
    date,
    startTime,
    endTime,
    duration:
      record.duration === null
        ? null
        : typeof record.duration === "undefined"
          ? (fallback?.duration ?? null)
          : asNonNegativeInteger(record.duration, fallback?.duration ?? 0),
    exercises,
    notes:
      typeof record.notes === "string" && record.notes.trim()
        ? record.notes.trim()
        : (fallback?.notes ?? null),
    totalVolume: asNonNegativeInteger(record.totalVolume, fallback?.totalVolume ?? 0),
    caloriesBurned: asNonNegativeInteger(record.caloriesBurned, fallback?.caloriesBurned ?? 0),
    completed:
      typeof record.completed === "boolean" ? record.completed : (fallback?.completed ?? false),
    aiGenerated:
      typeof record.aiGenerated === "boolean"
        ? record.aiGenerated
        : (fallback?.aiGenerated ?? false),
  };
}

function serializeWorkoutSession(row: MemberWorkoutSession) {
  return {
    id: row.id,
    name: row.name,
    date: row.date,
    startTime: row.startTime.getTime(),
    endTime: row.endTime ? row.endTime.getTime() : undefined,
    duration: row.duration ?? undefined,
    exercises: row.exercises,
    notes: row.notes ?? undefined,
    totalVolume: row.totalVolume,
    caloriesBurned: row.caloriesBurned,
    completed: row.completed,
    aiGenerated: row.aiGenerated,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializePersonalRecord(row: MemberPersonalRecord) {
  return {
    exerciseId: row.exerciseId,
    name: row.name,
    weight: row.weight,
    reps: row.reps,
    date: row.date,
    sessionId: row.sessionId ?? undefined,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function oneRepMaxEstimate(weight: number, reps: number) {
  return Math.round(weight * (1 + reps / 30));
}

async function findWorkoutSessionById(id: string) {
  const [row] = await db
    .select()
    .from(memberWorkoutSessions)
    .where(eq(memberWorkoutSessions.id, id))
    .limit(1);
  return row ?? null;
}

async function persistSessionPersonalRecords(
  gymId: string,
  memberClerkId: string,
  session: NormalizedWorkoutSession,
) {
  if (!session.completed) {
    return [];
  }

  const existingRows = await db
    .select()
    .from(memberPersonalRecords)
    .where(
      and(
        eq(memberPersonalRecords.gymId, gymId),
        eq(memberPersonalRecords.memberClerkId, memberClerkId),
      ),
    );
  const bestByExercise = new Map(existingRows.map((row) => [row.exerciseId, row]));
  const improvedRecords: MemberPersonalRecord[] = [];

  for (const exercise of session.exercises) {
    for (const set of exercise.sets) {
      if (!set.completed || set.weight <= 0 || set.reps <= 0) continue;
      const current = bestByExercise.get(exercise.exerciseId);
      const nextOneRepMax = oneRepMaxEstimate(set.weight, set.reps);
      const currentOneRepMax = current ? oneRepMaxEstimate(current.weight, current.reps) : 0;
      if (current && nextOneRepMax <= currentOneRepMax) continue;

      const now = new Date();
      const [record] = await db
        .insert(memberPersonalRecords)
        .values({
          id: current?.id ?? randomUUID(),
          gymId,
          memberClerkId,
          exerciseId: exercise.exerciseId,
          name: exercise.name,
          weight: set.weight,
          reps: set.reps,
          date: session.date,
          sessionId: session.id,
        })
        .onConflictDoUpdate({
          target: [
            memberPersonalRecords.gymId,
            memberPersonalRecords.memberClerkId,
            memberPersonalRecords.exerciseId,
          ],
          set: {
            name: exercise.name,
            weight: set.weight,
            reps: set.reps,
            date: session.date,
            sessionId: session.id,
            updatedAt: now,
          },
        })
        .returning();

      bestByExercise.set(exercise.exerciseId, record);
      improvedRecords.push(record);
    }
  }

  return improvedRecords;
}

async function requireTrainerOrOwner(
  req: Request,
  res: Response,
): Promise<Awaited<ReturnType<typeof requireApprovedAccess>> | null> {
  return requireApprovedAccess(req, res, ["trainer", "owner"]);
}

async function requireWorkoutMemberAccess(
  req: Request,
  res: Response,
): Promise<Awaited<ReturnType<typeof requireApprovedAccess>> | null> {
  return requireApprovedAccess(req, res, ["member", "trainer", "owner"]);
}

router.get("/members", async (req: Request, res: Response) => {
  try {
    const access = await requireTrainerOrOwner(req, res);
    if (!access) return;

    const profiles = await db
      .select({
        id: userProfiles.clerkId,
        name: userProfiles.name,
      })
      .from(userProfiles)
      .where(and(eq(userProfiles.gymId, access.gymId), eq(userProfiles.role, "member")))
      .orderBy(userProfiles.name);

    const users = await listAllClerkUsers(process.env.CLERK_SECRET_KEY!);
    const usersById = new Map(
      users.map((user) => [
        user.id,
        {
          email: user.emailAddresses[0]?.emailAddress ?? "",
          fallbackName: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim(),
        },
      ]),
    );

    const members = profiles.map((profile) => {
      const clerkData = usersById.get(profile.id);
      const resolvedName =
        profile.name.trim() || clerkData?.fallbackName || clerkData?.email || profile.id;

      return {
        id: profile.id,
        name: resolvedName,
        email: clerkData?.email ?? "",
      };
    });

    res.json(members);
  } catch (err) {
    req.log.error({ err }, "Error fetching workout members");
    res.status(500).json({ error: "Failed to fetch members" });
  }
});

router.get("/templates", async (req: Request, res: Response) => {
  try {
    const access = await requireTrainerOrOwner(req, res);
    if (!access) return;
    const templates = await db
      .select()
      .from(workoutTemplates)
      .where(
        and(
          eq(workoutTemplates.gymId, access.gymId),
          eq(workoutTemplates.trainerId, access.userId),
        ),
      )
      .orderBy(workoutTemplates.createdAt);
    res.json(templates);
  } catch (err) {
    req.log.error({ err }, "Error fetching templates");
    res.status(500).json({ error: "Failed to fetch templates" });
  }
});

router.post("/templates", async (req: Request, res: Response) => {
  try {
    const access = await requireTrainerOrOwner(req, res);
    if (!access) return;
    const body = readObjectBody(req.body, res);
    if (!body) return;
    const { name, exercises, trainerName } = body as {
      name?: unknown;
      exercises?: unknown;
      trainerName?: unknown;
    };
    if (!name || typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    if (!exercises || !Array.isArray(exercises) || exercises.length === 0) {
      res.status(400).json({ error: "exercises must be a non-empty array" });
      return;
    }
    const parsed: TemplateExercise[] = exercises.map((e) => {
      const ex = e as Record<string, unknown>;
      return {
        exerciseId: typeof ex.exerciseId === "string" ? ex.exerciseId : String(ex.exerciseId ?? ""),
        name: typeof ex.name === "string" ? ex.name : String(ex.name ?? ""),
        sets: typeof ex.sets === "number" ? ex.sets : parseInt(String(ex.sets ?? 3), 10) || 3,
        reps: typeof ex.reps === "number" ? ex.reps : parseInt(String(ex.reps ?? 10), 10) || 10,
        notes: typeof ex.notes === "string" && ex.notes ? ex.notes : undefined,
      };
    });
    const [template] = await db
      .insert(workoutTemplates)
      .values({
        gymId: access.gymId,
        trainerId: access.userId,
        trainerName:
          typeof trainerName === "string" && trainerName.trim() ? trainerName.trim() : "Trainer",
        name: name.trim(),
        exercises: parsed,
      })
      .returning();
    res.status(201).json(template);
  } catch (err) {
    req.log.error({ err }, "Error creating template");
    res.status(500).json({ error: "Failed to create template" });
  }
});

router.delete("/templates/:id", async (req: Request, res: Response) => {
  try {
    const access = await requireTrainerOrOwner(req, res);
    if (!access) return;
    const rawTemplateId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const templateId = parseInt(rawTemplateId, 10);
    if (isNaN(templateId)) {
      res.status(400).json({ error: "Invalid template id" });
      return;
    }
    await db
      .delete(workoutTemplates)
      .where(
        and(
          eq(workoutTemplates.id, templateId),
          eq(workoutTemplates.gymId, access.gymId),
          eq(workoutTemplates.trainerId, access.userId),
        ),
      );
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting template");
    res.status(500).json({ error: "Failed to delete template" });
  }
});

router.post("/assign", async (req: Request, res: Response) => {
  try {
    const access = await requireTrainerOrOwner(req, res);
    if (!access) return;
    const body = readObjectBody(req.body, res);
    if (!body) return;
    const { templateId, memberId } = body as {
      templateId?: unknown;
      memberId?: unknown;
    };
    if (!templateId || typeof templateId !== "number") {
      res.status(400).json({ error: "templateId is required" });
      return;
    }
    if (!memberId || typeof memberId !== "string" || !memberId.trim()) {
      res.status(400).json({ error: "memberId is required" });
      return;
    }
    const template = await db
      .select()
      .from(workoutTemplates)
      .where(
        and(
          eq(workoutTemplates.id, templateId),
          eq(workoutTemplates.gymId, access.gymId),
          eq(workoutTemplates.trainerId, access.userId),
        ),
      )
      .limit(1);
    if (!template.length) {
      res.status(404).json({ error: "Template not found or not owned by you" });
      return;
    }

    const [memberProfile] = await db
      .select({
        clerkId: userProfiles.clerkId,
        name: userProfiles.name,
      })
      .from(userProfiles)
      .where(
        and(
          eq(userProfiles.clerkId, memberId.trim()),
          eq(userProfiles.gymId, access.gymId),
          eq(userProfiles.role, "member"),
        ),
      )
      .limit(1);

    if (!memberProfile) {
      res.status(404).json({ error: "Member not found" });
      return;
    }

    const [assignment] = await db
      .insert(workoutAssignments)
      .values({
        gymId: access.gymId,
        templateId,
        trainerId: access.userId,
        memberName: memberProfile.name.trim() || memberProfile.clerkId,
        memberClerkId: memberProfile.clerkId,
      })
      .returning();
    res.status(201).json(assignment);
  } catch (err) {
    req.log.error({ err }, "Error assigning workout");
    res.status(500).json({ error: "Failed to assign workout" });
  }
});

router.get("/sessions", async (req: Request, res: Response) => {
  try {
    const access = await requireWorkoutMemberAccess(req, res);
    if (!access) return;

    const rows = await db
      .select()
      .from(memberWorkoutSessions)
      .where(
        and(
          eq(memberWorkoutSessions.gymId, access.gymId),
          eq(memberWorkoutSessions.memberClerkId, access.userId),
        ),
      )
      .orderBy(desc(memberWorkoutSessions.updatedAt));

    res.json(rows.map(serializeWorkoutSession));
  } catch (err) {
    req.log.error({ err }, "Error fetching member workout sessions");
    res.status(500).json({ error: "Failed to fetch workout sessions" });
  }
});

router.post("/sessions", async (req: Request, res: Response) => {
  try {
    const access = await requireWorkoutMemberAccess(req, res);
    if (!access) return;

    const payload = parseWorkoutSessionPayload(req.body);
    if (!payload) {
      res.status(400).json({ error: "Invalid workout session payload" });
      return;
    }

    const existingSession = await findWorkoutSessionById(payload.id);
    if (
      existingSession &&
      (existingSession.gymId !== access.gymId || existingSession.memberClerkId !== access.userId)
    ) {
      res.status(409).json({ error: "Workout session id already exists" });
      return;
    }

    const now = new Date();
    const values = {
      id: payload.id,
      gymId: access.gymId,
      memberClerkId: access.userId,
      name: payload.name,
      date: payload.date,
      startTime: payload.startTime,
      endTime: payload.endTime,
      duration: payload.duration,
      exercises: payload.exercises,
      notes: payload.notes,
      totalVolume: payload.totalVolume,
      caloriesBurned: payload.caloriesBurned,
      completed: payload.completed,
      aiGenerated: payload.aiGenerated,
    };

    const [session] = existingSession
      ? await db
          .update(memberWorkoutSessions)
          .set({ ...values, updatedAt: now })
          .where(
            and(
              eq(memberWorkoutSessions.id, payload.id),
              eq(memberWorkoutSessions.gymId, access.gymId),
              eq(memberWorkoutSessions.memberClerkId, access.userId),
            ),
          )
          .returning()
      : await db.insert(memberWorkoutSessions).values(values).returning();

    const improvedRecords = await persistSessionPersonalRecords(access.gymId, access.userId, {
      ...payload,
      id: session.id,
    });

    res.status(existingSession ? 200 : 201).json({
      session: serializeWorkoutSession(session),
      personalRecords: improvedRecords.map(serializePersonalRecord),
    });
  } catch (err) {
    req.log.error({ err }, "Error saving member workout session");
    res.status(500).json({ error: "Failed to save workout session" });
  }
});

router.patch("/sessions/:id", async (req: Request, res: Response) => {
  try {
    const access = await requireWorkoutMemberAccess(req, res);
    if (!access) return;

    const sessionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!sessionId || !sessionId.trim()) {
      res.status(400).json({ error: "Invalid workout session id" });
      return;
    }

    const [existingSession] = await db
      .select()
      .from(memberWorkoutSessions)
      .where(
        and(
          eq(memberWorkoutSessions.id, sessionId),
          eq(memberWorkoutSessions.gymId, access.gymId),
          eq(memberWorkoutSessions.memberClerkId, access.userId),
        ),
      )
      .limit(1);

    if (!existingSession) {
      res.status(404).json({ error: "Workout session not found" });
      return;
    }

    const payload = parseWorkoutSessionPayload({ ...req.body, id: sessionId }, existingSession);
    if (!payload) {
      res.status(400).json({ error: "Invalid workout session payload" });
      return;
    }

    const [session] = await db
      .update(memberWorkoutSessions)
      .set({
        name: payload.name,
        date: payload.date,
        startTime: payload.startTime,
        endTime: payload.endTime,
        duration: payload.duration,
        exercises: payload.exercises,
        notes: payload.notes,
        totalVolume: payload.totalVolume,
        caloriesBurned: payload.caloriesBurned,
        completed: payload.completed,
        aiGenerated: payload.aiGenerated,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(memberWorkoutSessions.id, sessionId),
          eq(memberWorkoutSessions.gymId, access.gymId),
          eq(memberWorkoutSessions.memberClerkId, access.userId),
        ),
      )
      .returning();

    const improvedRecords = await persistSessionPersonalRecords(access.gymId, access.userId, {
      ...payload,
      id: session.id,
    });

    res.json({
      session: serializeWorkoutSession(session),
      personalRecords: improvedRecords.map(serializePersonalRecord),
    });
  } catch (err) {
    req.log.error({ err }, "Error updating member workout session");
    res.status(500).json({ error: "Failed to update workout session" });
  }
});

router.delete("/sessions/:id", async (req: Request, res: Response) => {
  try {
    const access = await requireWorkoutMemberAccess(req, res);
    if (!access) return;

    const sessionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!sessionId || !sessionId.trim()) {
      res.status(400).json({ error: "Invalid workout session id" });
      return;
    }

    const deleted = await db
      .delete(memberWorkoutSessions)
      .where(
        and(
          eq(memberWorkoutSessions.id, sessionId),
          eq(memberWorkoutSessions.gymId, access.gymId),
          eq(memberWorkoutSessions.memberClerkId, access.userId),
        ),
      )
      .returning({ id: memberWorkoutSessions.id });

    if (!deleted.length) {
      res.status(404).json({ error: "Workout session not found" });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting member workout session");
    res.status(500).json({ error: "Failed to delete workout session" });
  }
});

router.get("/personal-records", async (req: Request, res: Response) => {
  try {
    const access = await requireWorkoutMemberAccess(req, res);
    if (!access) return;

    const rows = await db
      .select()
      .from(memberPersonalRecords)
      .where(
        and(
          eq(memberPersonalRecords.gymId, access.gymId),
          eq(memberPersonalRecords.memberClerkId, access.userId),
        ),
      );

    res.json(
      Object.fromEntries(
        rows.map((record) => [record.exerciseId, serializePersonalRecord(record)]),
      ),
    );
  } catch (err) {
    req.log.error({ err }, "Error fetching member personal records");
    res.status(500).json({ error: "Failed to fetch personal records" });
  }
});

router.get("/member-plans", async (req: Request, res: Response) => {
  try {
    const access = await requireApprovedAccess(req, res);
    if (!access) return;
    const callerUserId = access.userId;

    const plans = await db
      .select()
      .from(memberWorkoutPlans)
      .where(
        and(
          eq(memberWorkoutPlans.gymId, access.gymId),
          eq(memberWorkoutPlans.memberClerkId, callerUserId),
        ),
      )
      .orderBy(desc(memberWorkoutPlans.updatedAt));

    res.json(plans.map(serializeMemberWorkoutPlan));
  } catch (err) {
    req.log.error({ err }, "Error fetching member workout plans");
    res.status(500).json({ error: "Failed to fetch saved workout plans" });
  }
});

router.post("/member-plans", async (req: Request, res: Response) => {
  try {
    const access = await requireApprovedAccess(req, res);
    if (!access) return;
    const callerUserId = access.userId;

    const { name, focus, exercises } = (req.body ?? {}) as {
      name?: string;
      focus?: string;
      exercises?: unknown;
    };

    if (!name || typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "name is required" });
      return;
    }

    const parsedExercises = parsePlanExercises(exercises);
    if (!parsedExercises) {
      res.status(400).json({ error: "exercises must be a non-empty array" });
      return;
    }

    const [plan] = await db
      .insert(memberWorkoutPlans)
      .values({
        id: randomUUID(),
        gymId: access.gymId,
        memberClerkId: callerUserId,
        name: name.trim(),
        focus: typeof focus === "string" && focus.trim() ? focus.trim() : null,
        exercises: parsedExercises,
      })
      .returning();

    res.status(201).json(serializeMemberWorkoutPlan(plan));
  } catch (err) {
    req.log.error({ err }, "Error creating member workout plan");
    res.status(500).json({ error: "Failed to save workout plan" });
  }
});

router.patch("/member-plans/:id", async (req: Request, res: Response) => {
  try {
    const access = await requireApprovedAccess(req, res);
    if (!access) return;
    const callerUserId = access.userId;

    const planId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!planId || !planId.trim()) {
      res.status(400).json({ error: "Invalid plan id" });
      return;
    }

    const { name, focus, exercises } = (req.body ?? {}) as {
      name?: string;
      focus?: string;
      exercises?: unknown;
    };

    if (!name || typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "name is required" });
      return;
    }

    const parsedExercises = parsePlanExercises(exercises);
    if (!parsedExercises) {
      res.status(400).json({ error: "exercises must be a non-empty array" });
      return;
    }

    const [updatedPlan] = await db
      .update(memberWorkoutPlans)
      .set({
        name: name.trim(),
        focus: typeof focus === "string" && focus.trim() ? focus.trim() : null,
        exercises: parsedExercises,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(memberWorkoutPlans.id, planId),
          eq(memberWorkoutPlans.gymId, access.gymId),
          eq(memberWorkoutPlans.memberClerkId, callerUserId),
        ),
      )
      .returning();

    if (!updatedPlan) {
      res.status(404).json({ error: "Workout plan not found" });
      return;
    }

    res.json(serializeMemberWorkoutPlan(updatedPlan));
  } catch (err) {
    req.log.error({ err }, "Error updating member workout plan");
    res.status(500).json({ error: "Failed to update workout plan" });
  }
});

router.delete("/member-plans/:id", async (req: Request, res: Response) => {
  try {
    const access = await requireApprovedAccess(req, res);
    if (!access) return;
    const callerUserId = access.userId;

    const planId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!planId || !planId.trim()) {
      res.status(400).json({ error: "Invalid plan id" });
      return;
    }

    const deleted = await db
      .delete(memberWorkoutPlans)
      .where(
        and(
          eq(memberWorkoutPlans.id, planId),
          eq(memberWorkoutPlans.gymId, access.gymId),
          eq(memberWorkoutPlans.memberClerkId, callerUserId),
        ),
      )
      .returning({ id: memberWorkoutPlans.id });

    if (!deleted.length) {
      res.status(404).json({ error: "Workout plan not found" });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting member workout plan");
    res.status(500).json({ error: "Failed to delete workout plan" });
  }
});

router.post("/assigned/bind", async (req: Request, res: Response) => {
  try {
    const access = await requireApprovedAccess(req, res);
    if (!access) return;
    const callerUserId = access.userId;
    const [serverProfile] = await db
      .select({ name: userProfiles.name })
      .from(userProfiles)
      .where(and(eq(userProfiles.clerkId, callerUserId), eq(userProfiles.gymId, access.gymId)))
      .limit(1);
    if (!serverProfile || !serverProfile.name) {
      res.status(400).json({ error: "Profile not found. Sync your profile first." });
      return;
    }
    const result = await db
      .update(workoutAssignments)
      .set({ memberClerkId: callerUserId })
      .where(
        and(
          eq(workoutAssignments.memberName, serverProfile.name),
          eq(workoutAssignments.gymId, access.gymId),
          isNull(workoutAssignments.memberClerkId),
        ),
      )
      .returning();
    res.json({ bound: result.length });
  } catch (err) {
    req.log.error({ err }, "Error binding assignments");
    res.status(500).json({ error: "Failed to bind assignments" });
  }
});

router.get("/assigned", async (req: Request, res: Response) => {
  try {
    const access = await requireApprovedAccess(req, res);
    if (!access) return;
    const callerUserId = access.userId;
    const memberId = Array.isArray(req.query.memberId)
      ? (req.query.memberId[0] as string)
      : (req.query.memberId as string | undefined);
    if (!memberId) {
      res.status(400).json({ error: "memberId query param is required" });
      return;
    }
    if (memberId !== callerUserId) {
      res.status(403).json({ error: "You can only fetch your own assigned workouts" });
      return;
    }
    const assignments = await db
      .select({
        id: workoutAssignments.id,
        templateId: workoutAssignments.templateId,
        trainerId: workoutAssignments.trainerId,
        memberName: workoutAssignments.memberName,
        memberClerkId: workoutAssignments.memberClerkId,
        assignedAt: workoutAssignments.assignedAt,
        completedAt: workoutAssignments.completedAt,
        templateName: workoutTemplates.name,
        trainerName: workoutTemplates.trainerName,
        exercises: workoutTemplates.exercises,
      })
      .from(workoutAssignments)
      .innerJoin(workoutTemplates, eq(workoutAssignments.templateId, workoutTemplates.id))
      .where(
        and(
          eq(workoutAssignments.gymId, access.gymId),
          eq(workoutAssignments.memberClerkId, callerUserId),
        ),
      );
    res.json(assignments);
  } catch (err) {
    req.log.error({ err }, "Error fetching assigned workouts");
    res.status(500).json({ error: "Failed to fetch assigned workouts" });
  }
});

router.patch("/assigned/:id/complete", async (req: Request, res: Response) => {
  try {
    const access = await requireApprovedAccess(req, res);
    if (!access) return;
    const callerUserId = access.userId;
    const rawAssignmentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const assignmentId = parseInt(rawAssignmentId, 10);
    if (isNaN(assignmentId)) {
      res.status(400).json({ error: "Invalid assignment id" });
      return;
    }
    const [updated] = await db
      .update(workoutAssignments)
      .set({ completedAt: new Date() })
      .where(
        and(
          eq(workoutAssignments.id, assignmentId),
          eq(workoutAssignments.gymId, access.gymId),
          eq(workoutAssignments.memberClerkId, callerUserId),
        ),
      )
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Assignment not found or not authorized" });
      return;
    }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Error completing assignment");
    res.status(500).json({ error: "Failed to complete assignment" });
  }
});

export default router;
