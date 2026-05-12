import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { db } from "@workspace/db";
import {
  exerciseCatalogItems,
  memberPersonalRecords,
  memberExercisePrs,
  memberExercises,
  memberWorkoutSets,
  memberWorkoutSessions,
  memberWorkoutPlans,
  workoutAssignments,
  workoutTemplates,
  type ExerciseType,
  type MemberExercise,
  type MemberExercisePr,
  type MemberPersonalRecord,
  type MemberWorkoutSet,
  type MemberWorkoutSession,
  type MemberWorkoutSessionExercise,
  type MemberWorkoutSessionSet,
  type MemberWorkoutPlanExercise,
} from "@workspace/db/schema";
import { userProfiles, type TemplateExercise } from "@workspace/db";
import { eq, and, isNull, desc, ilike, or } from "drizzle-orm";
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

type WorkoutDb = Pick<typeof db, "select" | "insert" | "update" | "delete">;
type TransactionCapableWorkoutDb = WorkoutDb & {
  transaction: <T>(callback: (transactionDb: WorkoutDb) => Promise<T>) => Promise<T>;
};

function hasWorkoutTransaction(database: WorkoutDb): database is TransactionCapableWorkoutDb {
  const maybeTransaction = (database as WorkoutDb & { transaction?: unknown }).transaction;
  return typeof maybeTransaction === "function";
}

function runWorkoutTransaction<T>(callback: (transactionDb: WorkoutDb) => Promise<T>) {
  const database: WorkoutDb = db;
  if (hasWorkoutTransaction(database)) {
    return database.transaction(callback);
  }
  return callback(database);
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

function asNonNegativeNumber(value: unknown, fallback = 0): number {
  const parsed = asFiniteNumber(value);
  return parsed === null ? fallback : Math.max(0, parsed);
}

function parseSetType(value: unknown) {
  return value === "warmup" || value === "normal" || value === "drop" || value === "failure"
    ? value
    : undefined;
}

function parseExerciseType(value: unknown): ExerciseType {
  return value === "bodyweight_reps" || value === "duration" || value === "distance_duration"
    ? value
    : "weight_reps";
}

function firstQueryValue(value: unknown): string | undefined {
  if (Array.isArray(value)) return firstQueryValue(value[0]);
  return typeof value === "string" ? value.trim() : undefined;
}

function clampLimit(value: unknown, fallback = 20) {
  const raw = firstQueryValue(value);
  const parsed = raw ? Number(raw) : null;
  return typeof parsed === "number" && Number.isFinite(parsed)
    ? Math.max(1, Math.min(100, Math.round(parsed)))
    : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
  );
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
    const weight = asNonNegativeNumber(record.weight, 0);
    const rpe = asFiniteNumber(record.rpe);
    const rir = asFiniteNumber(record.rir);
    const previousWeight = asFiniteNumber(record.previousWeight);
    const previousReps = asFiniteNumber(record.previousReps);
    parsed.push({
      id,
      weight,
      reps,
      completed: Boolean(record.completed),
      ...(parseSetType(record.type) ? { type: parseSetType(record.type) } : {}),
      ...(typeof rpe === "number" ? { rpe: Math.min(10, Math.max(1, rpe)) } : {}),
      ...(typeof rir === "number" ? { rir: Math.min(10, Math.max(0, Math.round(rir))) } : {}),
      ...(typeof record.notes === "string" && record.notes.trim()
        ? { notes: record.notes.trim() }
        : {}),
      ...(typeof previousWeight === "number" ? { previousWeight } : {}),
      ...(typeof previousReps === "number" ? { previousReps } : {}),
      ...(typeof record.progressionHint === "string" && record.progressionHint.trim()
        ? { progressionHint: record.progressionHint.trim() }
        : {}),
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

function serializeExerciseCatalog(row: typeof exerciseCatalogItems.$inferSelect) {
  return {
    id: row.id,
    source: "system" as const,
    slug: row.slug,
    name: row.name,
    aliases: row.aliases,
    primaryMuscles: row.primaryMuscles,
    secondaryMuscles: row.secondaryMuscles,
    equipment: row.equipment ?? undefined,
    exerciseType: row.exerciseType,
    instructions: row.instructions,
    isSystem: row.isSystem,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeMemberExercise(row: MemberExercise) {
  return {
    id: row.id,
    source: "member_custom" as const,
    baseExerciseId: row.baseExerciseId ?? undefined,
    name: row.name,
    aliases: row.aliases,
    primaryMuscles: row.primaryMuscles,
    equipment: row.equipment ?? undefined,
    exerciseType: row.exerciseType,
    notes: row.notes ?? undefined,
    archivedAt: row.archivedAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeWorkoutSetHistory(row: MemberWorkoutSet) {
  return {
    id: row.id,
    sessionId: row.sessionId,
    exerciseId: row.exerciseId,
    exerciseName: row.exerciseName,
    setId: row.setId,
    setIndex: row.setIndex,
    setType: row.setType,
    weight: row.weight,
    reps: row.reps,
    durationSeconds: row.durationSeconds ?? undefined,
    distanceMeters: row.distanceMeters ?? undefined,
    rpe: row.rpe ?? undefined,
    rir: row.rir ?? undefined,
    completed: row.completed,
    performedAt: row.performedAt.toISOString(),
    date: row.date,
  };
}

function serializeExercisePr(row: MemberExercisePr) {
  return {
    id: row.id,
    exerciseId: row.exerciseId,
    metric: row.metric,
    value: row.value,
    weight: row.weight ?? undefined,
    reps: row.reps ?? undefined,
    sessionId: row.sessionId ?? undefined,
    setId: row.setId ?? undefined,
    achievedAt: row.achievedAt.toISOString(),
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
  database: WorkoutDb,
  gymId: string,
  memberClerkId: string,
  session: NormalizedWorkoutSession,
) {
  if (!session.completed) {
    return [];
  }

  const existingRows = await database
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
      const [record] = await database
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

function buildWorkoutSetRows(
  gymId: string,
  memberClerkId: string,
  session: NormalizedWorkoutSession,
): (typeof memberWorkoutSets.$inferInsert)[] {
  const performedAt = session.endTime ?? session.startTime;
  return session.exercises.flatMap((exercise) =>
    exercise.sets.flatMap((set, index) => {
      if (!set.completed) return [];
      return [
        {
          id: randomUUID(),
          gymId,
          memberClerkId,
          sessionId: session.id,
          exerciseId: exercise.exerciseId,
          exerciseName: exercise.name,
          setId: set.id,
          setIndex: index + 1,
          setType: set.type ?? "normal",
          weight: set.weight,
          reps: set.reps,
          rpe: set.rpe ?? null,
          rir: set.rir ?? null,
          completed: set.completed,
          performedAt,
          date: session.date,
        },
      ];
    }),
  );
}

async function rebuildWorkoutSetHistory(
  database: WorkoutDb,
  gymId: string,
  memberClerkId: string,
  session: NormalizedWorkoutSession,
) {
  await database
    .delete(memberWorkoutSets)
    .where(
      and(
        eq(memberWorkoutSets.gymId, gymId),
        eq(memberWorkoutSets.memberClerkId, memberClerkId),
        eq(memberWorkoutSets.sessionId, session.id),
      ),
    )
    .returning({ id: memberWorkoutSets.id });

  const rows = buildWorkoutSetRows(gymId, memberClerkId, session);
  if (rows.length) {
    await database.insert(memberWorkoutSets).values(rows).returning({ id: memberWorkoutSets.id });
  }
}

interface ExerciseMetricCandidate {
  metric: "estimated_1rm" | "max_weight" | "max_reps" | "max_volume_set";
  value: number;
  exerciseId: string;
  exerciseName: string;
  weight: number;
  reps: number;
  setId: string;
  achievedAt: Date;
}

function metricCandidatesForSession(session: NormalizedWorkoutSession): ExerciseMetricCandidate[] {
  const achievedAt = session.endTime ?? session.startTime;
  const candidates = new Map<string, ExerciseMetricCandidate>();

  for (const exercise of session.exercises) {
    for (const set of exercise.sets) {
      if (!set.completed || set.weight <= 0 || set.reps <= 0) continue;
      const metrics: ExerciseMetricCandidate[] = [
        {
          metric: "estimated_1rm",
          value: oneRepMaxEstimate(set.weight, set.reps),
          exerciseId: exercise.exerciseId,
          exerciseName: exercise.name,
          weight: set.weight,
          reps: set.reps,
          setId: set.id,
          achievedAt,
        },
        {
          metric: "max_weight",
          value: set.weight,
          exerciseId: exercise.exerciseId,
          exerciseName: exercise.name,
          weight: set.weight,
          reps: set.reps,
          setId: set.id,
          achievedAt,
        },
        {
          metric: "max_reps",
          value: set.reps,
          exerciseId: exercise.exerciseId,
          exerciseName: exercise.name,
          weight: set.weight,
          reps: set.reps,
          setId: set.id,
          achievedAt,
        },
        {
          metric: "max_volume_set",
          value: set.weight * set.reps,
          exerciseId: exercise.exerciseId,
          exerciseName: exercise.name,
          weight: set.weight,
          reps: set.reps,
          setId: set.id,
          achievedAt,
        },
      ];

      for (const candidate of metrics) {
        const key = `${candidate.exerciseId}:${candidate.metric}`;
        const existing = candidates.get(key);
        if (!existing || candidate.value > existing.value) {
          candidates.set(key, candidate);
        }
      }
    }
  }

  return [...candidates.values()];
}

async function persistExercisePrMetrics(
  database: WorkoutDb,
  gymId: string,
  memberClerkId: string,
  session: NormalizedWorkoutSession,
) {
  if (!session.completed) return [];

  const existingRows = await database
    .select()
    .from(memberExercisePrs)
    .where(
      and(eq(memberExercisePrs.gymId, gymId), eq(memberExercisePrs.memberClerkId, memberClerkId)),
    );
  const existingByMetric = new Map(
    existingRows.map((row) => [`${row.exerciseId}:${row.metric}`, row] as const),
  );
  const improved: MemberExercisePr[] = [];

  for (const candidate of metricCandidatesForSession(session)) {
    const existing = existingByMetric.get(`${candidate.exerciseId}:${candidate.metric}`);
    if (existing && existing.value >= candidate.value) continue;

    const [record] = await database
      .insert(memberExercisePrs)
      .values({
        id: existing?.id ?? randomUUID(),
        gymId,
        memberClerkId,
        exerciseId: candidate.exerciseId,
        metric: candidate.metric,
        value: candidate.value,
        weight: candidate.weight,
        reps: candidate.reps,
        sessionId: session.id,
        setId: candidate.setId,
        achievedAt: candidate.achievedAt,
      })
      .onConflictDoUpdate({
        target: [
          memberExercisePrs.gymId,
          memberExercisePrs.memberClerkId,
          memberExercisePrs.exerciseId,
          memberExercisePrs.metric,
        ],
        set: {
          value: candidate.value,
          weight: candidate.weight,
          reps: candidate.reps,
          sessionId: session.id,
          setId: candidate.setId,
          achievedAt: candidate.achievedAt,
          updatedAt: new Date(),
        },
      })
      .returning();
    improved.push(record);
  }

  return improved;
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

router.get("/exercises", async (req: Request, res: Response) => {
  try {
    const access = await requireWorkoutMemberAccess(req, res);
    if (!access) return;

    const query = firstQueryValue(req.query.q);
    const limit = clampLimit(req.query.limit, 25);
    const likeQuery = `%${query ?? ""}%`;

    const memberRows = await db
      .select()
      .from(memberExercises)
      .where(
        query
          ? and(
              eq(memberExercises.gymId, access.gymId),
              eq(memberExercises.memberClerkId, access.userId),
              isNull(memberExercises.archivedAt),
              ilike(memberExercises.name, likeQuery),
            )
          : and(
              eq(memberExercises.gymId, access.gymId),
              eq(memberExercises.memberClerkId, access.userId),
              isNull(memberExercises.archivedAt),
            ),
      )
      .orderBy(desc(memberExercises.updatedAt))
      .limit(limit);

    const remainingLimit = Math.max(0, limit - memberRows.length);
    const catalogRows =
      remainingLimit > 0
        ? await db
            .select()
            .from(exerciseCatalogItems)
            .where(
              query
                ? or(
                    ilike(exerciseCatalogItems.name, likeQuery),
                    ilike(exerciseCatalogItems.slug, likeQuery),
                  )
                : eq(exerciseCatalogItems.isSystem, true),
            )
            .orderBy(exerciseCatalogItems.name)
            .limit(remainingLimit)
        : [];

    res.json({
      items: [
        ...memberRows.map(serializeMemberExercise),
        ...catalogRows.map(serializeExerciseCatalog),
      ],
    });
  } catch (err) {
    req.log.error({ err }, "Error searching workout exercises");
    res.status(500).json({ error: "Failed to search exercises" });
  }
});

router.post("/exercises/custom", async (req: Request, res: Response) => {
  try {
    const access = await requireWorkoutMemberAccess(req, res);
    if (!access) return;

    const body = readObjectBody(req.body, res);
    if (!body) return;

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }

    const [exercise] = await db
      .insert(memberExercises)
      .values({
        id: randomUUID(),
        gymId: access.gymId,
        memberClerkId: access.userId,
        baseExerciseId:
          typeof body.baseExerciseId === "string" && body.baseExerciseId.trim()
            ? body.baseExerciseId.trim()
            : null,
        name,
        aliases: asStringArray(body.aliases),
        primaryMuscles: asStringArray(body.primaryMuscles),
        equipment:
          typeof body.equipment === "string" && body.equipment.trim()
            ? body.equipment.trim()
            : null,
        exerciseType: parseExerciseType(body.exerciseType),
        notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
      })
      .returning();

    res.status(201).json({ item: serializeMemberExercise(exercise) });
  } catch (err) {
    req.log.error({ err }, "Error creating custom exercise");
    res.status(500).json({ error: "Failed to create custom exercise" });
  }
});

router.get("/exercises/:exerciseId/history", async (req: Request, res: Response) => {
  try {
    const access = await requireWorkoutMemberAccess(req, res);
    if (!access) return;

    const exerciseId = Array.isArray(req.params.exerciseId)
      ? req.params.exerciseId[0]
      : req.params.exerciseId;
    if (!exerciseId || !exerciseId.trim()) {
      res.status(400).json({ error: "exerciseId is required" });
      return;
    }

    const limit = clampLimit(req.query.limit, 20);
    const sets = await db
      .select()
      .from(memberWorkoutSets)
      .where(
        and(
          eq(memberWorkoutSets.gymId, access.gymId),
          eq(memberWorkoutSets.memberClerkId, access.userId),
          eq(memberWorkoutSets.exerciseId, exerciseId.trim()),
          eq(memberWorkoutSets.completed, true),
        ),
      )
      .orderBy(desc(memberWorkoutSets.performedAt))
      .limit(limit);

    const prs = await db
      .select()
      .from(memberExercisePrs)
      .where(
        and(
          eq(memberExercisePrs.gymId, access.gymId),
          eq(memberExercisePrs.memberClerkId, access.userId),
          eq(memberExercisePrs.exerciseId, exerciseId.trim()),
        ),
      )
      .orderBy(desc(memberExercisePrs.achievedAt));

    res.json({
      exerciseId: exerciseId.trim(),
      sets: sets.map(serializeWorkoutSetHistory),
      personalRecords: prs.map(serializeExercisePr),
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching exercise history");
    res.status(500).json({ error: "Failed to fetch exercise history" });
  }
});

router.get("/analytics", async (req: Request, res: Response) => {
  try {
    const access = await requireWorkoutMemberAccess(req, res);
    if (!access) return;

    const from = firstQueryValue(req.query.from);
    const to = firstQueryValue(req.query.to);
    const recentSets = await db
      .select()
      .from(memberWorkoutSets)
      .where(
        and(
          eq(memberWorkoutSets.gymId, access.gymId),
          eq(memberWorkoutSets.memberClerkId, access.userId),
          eq(memberWorkoutSets.completed, true),
        ),
      )
      .orderBy(desc(memberWorkoutSets.performedAt))
      .limit(1000);

    const filtered = recentSets.filter(
      (set) => (!from || set.date >= from) && (!to || set.date <= to),
    );
    const byExercise = new Map<string, { name: string; volume: number; sets: number }>();
    for (const set of filtered) {
      const current = byExercise.get(set.exerciseId) ?? {
        name: set.exerciseName,
        volume: 0,
        sets: 0,
      };
      current.volume += set.weight * set.reps;
      current.sets += 1;
      byExercise.set(set.exerciseId, current);
    }

    res.json({
      from: from ?? null,
      to: to ?? null,
      completedSets: filtered.length,
      totalVolume: Math.round(filtered.reduce((sum, set) => sum + set.weight * set.reps, 0)),
      workoutDays: new Set(filtered.map((set) => set.date)).size,
      topExercises: [...byExercise.entries()]
        .map(([exerciseId, summary]) => ({ exerciseId, ...summary }))
        .sort((left, right) => right.volume - left.volume)
        .slice(0, 10),
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching workout analytics");
    res.status(500).json({ error: "Failed to fetch workout analytics" });
  }
});

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

    const { session, improvedRecords } = await runWorkoutTransaction(async (transactionDb) => {
      const [savedSession] = existingSession
        ? await transactionDb
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
        : await transactionDb.insert(memberWorkoutSessions).values(values).returning();

      const normalizedSavedSession = {
        ...payload,
        id: savedSession.id,
      };
      const records = await persistSessionPersonalRecords(
        transactionDb,
        access.gymId,
        access.userId,
        normalizedSavedSession,
      );
      await rebuildWorkoutSetHistory(
        transactionDb,
        access.gymId,
        access.userId,
        normalizedSavedSession,
      );
      await persistExercisePrMetrics(
        transactionDb,
        access.gymId,
        access.userId,
        normalizedSavedSession,
      );
      return { session: savedSession, improvedRecords: records };
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

    const { session, improvedRecords } = await runWorkoutTransaction(async (transactionDb) => {
      const [savedSession] = await transactionDb
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

      const normalizedSavedSession = {
        ...payload,
        id: savedSession.id,
      };
      const records = await persistSessionPersonalRecords(
        transactionDb,
        access.gymId,
        access.userId,
        normalizedSavedSession,
      );
      await rebuildWorkoutSetHistory(
        transactionDb,
        access.gymId,
        access.userId,
        normalizedSavedSession,
      );
      await persistExercisePrMetrics(
        transactionDb,
        access.gymId,
        access.userId,
        normalizedSavedSession,
      );
      return { session: savedSession, improvedRecords: records };
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

    const deleted = await runWorkoutTransaction(async (transactionDb) => {
      const deletedRows = await transactionDb
        .delete(memberWorkoutSessions)
        .where(
          and(
            eq(memberWorkoutSessions.id, sessionId),
            eq(memberWorkoutSessions.gymId, access.gymId),
            eq(memberWorkoutSessions.memberClerkId, access.userId),
          ),
        )
        .returning({ id: memberWorkoutSessions.id });

      if (deletedRows.length) {
        await transactionDb
          .delete(memberWorkoutSets)
          .where(
            and(
              eq(memberWorkoutSets.gymId, access.gymId),
              eq(memberWorkoutSets.memberClerkId, access.userId),
              eq(memberWorkoutSets.sessionId, sessionId),
            ),
          )
          .returning({ id: memberWorkoutSets.id });
        await transactionDb
          .delete(memberExercisePrs)
          .where(
            and(
              eq(memberExercisePrs.gymId, access.gymId),
              eq(memberExercisePrs.memberClerkId, access.userId),
              eq(memberExercisePrs.sessionId, sessionId),
            ),
          )
          .returning({ id: memberExercisePrs.id });
      }

      return deletedRows;
    });

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
