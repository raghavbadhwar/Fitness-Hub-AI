import { Router, type Request, type Response } from "express";
import { and, eq, gte } from "drizzle-orm";
import { db, gymClassesTable, pool, type ClassAttendanceRecord } from "@workspace/db";
import { requireApiAuth } from "../middlewares/apiAuth.ts";
import { requireApprovedAccess } from "../lib/user-access.ts";

const router = Router();
type PoolClient = {
  query<Row>(
    queryText: string,
    values?: unknown[],
  ): Promise<{
    rows: Row[];
  }>;
  release(): void;
};
type LockedClassRow = {
  id: number;
  gym_id: string;
  name: string;
  category: string;
  description: string;
  trainer: string;
  date: string;
  start_time: string;
  duration: number;
  max_participants: number;
  enrolled_count: number;
  enrolled_member_ids: string[] | null;
  waitlisted_member_ids: string[] | null;
  attendance_records: unknown[] | null;
  room: string;
  status: string;
  color: string;
  created_at: string | Date;
  updated_at: string | Date;
};

class RouteError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

function isRouteError(error: unknown): error is RouteError {
  return error instanceof RouteError;
}

function serializeClass(cls: typeof gymClassesTable.$inferSelect) {
  const waitlistedMemberIds = Array.isArray(cls.waitlistedMemberIds) ? cls.waitlistedMemberIds : [];

  return {
    id: cls.id,
    name: cls.name,
    category: cls.category,
    description: cls.description,
    trainer: cls.trainer,
    date: cls.date,
    startTime: cls.startTime,
    duration: cls.duration,
    maxParticipants: cls.maxParticipants,
    enrolledCount: cls.enrolledCount,
    waitlistedCount: waitlistedMemberIds.length,
    room: cls.room,
    status: cls.status,
    color: cls.color,
    createdAt: cls.createdAt.toISOString(),
    updatedAt: cls.updatedAt.toISOString(),
  };
}

function hydrateLockedClass(row: LockedClassRow): typeof gymClassesTable.$inferSelect {
  return {
    id: row.id,
    gymId: row.gym_id,
    name: row.name,
    category: row.category,
    description: row.description,
    trainer: row.trainer,
    date: row.date,
    startTime: row.start_time,
    duration: row.duration,
    maxParticipants: row.max_participants,
    enrolledCount: row.enrolled_count,
    enrolledMemberIds: Array.isArray(row.enrolled_member_ids) ? row.enrolled_member_ids : [],
    waitlistedMemberIds: Array.isArray(row.waitlisted_member_ids) ? row.waitlisted_member_ids : [],
    attendanceRecords: Array.isArray(row.attendance_records)
      ? (row.attendance_records as ClassAttendanceRecord[])
      : [],
    room: row.room,
    status: row.status,
    color: row.color,
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at),
  };
}

async function loadLockedClass(
  client: PoolClient,
  classId: number,
  gymId: string,
): Promise<typeof gymClassesTable.$inferSelect | null> {
  const result = await client.query<LockedClassRow>(
    `SELECT
        id,
        gym_id,
        name,
        category,
        description,
        trainer,
        date,
        start_time,
        duration,
        max_participants,
        enrolled_count,
        enrolled_member_ids,
        waitlisted_member_ids,
        attendance_records,
        room,
        status,
        color,
        created_at,
        updated_at
      FROM gym_classes
      WHERE id = $1 AND gym_id = $2
      FOR UPDATE`,
    [classId, gymId],
  );

  return result.rows[0] ? hydrateLockedClass(result.rows[0]) : null;
}

async function persistLockedClassRoster(
  client: PoolClient,
  classId: number,
  gymId: string,
  enrolledCount: number,
  enrolledMemberIds: string[],
  waitlistedMemberIds: string[],
) {
  const result = await client.query<LockedClassRow>(
    `UPDATE gym_classes
      SET enrolled_count = $2,
          enrolled_member_ids = $3::jsonb,
          waitlisted_member_ids = $4::jsonb,
          updated_at = NOW()
      WHERE id = $1 AND gym_id = $5
      RETURNING
        id,
        gym_id,
        name,
        category,
        description,
        trainer,
        date,
        start_time,
        duration,
        max_participants,
        enrolled_count,
        enrolled_member_ids,
        waitlisted_member_ids,
        attendance_records,
        room,
        status,
        color,
        created_at,
        updated_at`,
    [
      classId,
      enrolledCount,
      JSON.stringify(enrolledMemberIds),
      JSON.stringify(waitlistedMemberIds),
      gymId,
    ],
  );

  return hydrateLockedClass(result.rows[0]);
}

function parseClassId(rawId: string | string[] | undefined): number | null {
  const value = Array.isArray(rawId) ? rawId[0] : rawId;
  const classId = parseInt(value ?? "", 10);
  return Number.isNaN(classId) ? null : classId;
}

async function withLockedClass(
  classId: number,
  gymId: string,
  mutate: (
    client: PoolClient,
    cls: typeof gymClassesTable.$inferSelect,
  ) => Promise<typeof gymClassesTable.$inferSelect>,
) {
  const client = await (pool.connect() as Promise<PoolClient>);

  try {
    await client.query("BEGIN");
    const cls = await loadLockedClass(client, classId, gymId);
    if (!cls) {
      await client.query("ROLLBACK");
      return null;
    }

    const updatedClass = await mutate(client, cls);
    await client.query("COMMIT");
    return updatedClass;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

router.get("/classes", requireApiAuth, async (req: Request, res: Response): Promise<void> => {
  const access = await requireApprovedAccess(req, res);
  if (!access) return;

  const today = new Date().toISOString().split("T")[0];
  const classes = await db
    .select()
    .from(gymClassesTable)
    .where(and(eq(gymClassesTable.gymId, access.gymId), gte(gymClassesTable.date, today)))
    .orderBy(gymClassesTable.date, gymClassesTable.startTime);

  res.json(classes.map(serializeClass));
});

router.get(
  "/classes/enrolled",
  requireApiAuth,
  async (req: Request, res: Response): Promise<void> => {
    const access = await requireApprovedAccess(req, res);
    if (!access) return;
    const callerUserId = access.userId;

    const today = new Date().toISOString().split("T")[0];
    const classes = await db
      .select({
        id: gymClassesTable.id,
        enrolledMemberIds: gymClassesTable.enrolledMemberIds,
      })
      .from(gymClassesTable)
      .where(and(eq(gymClassesTable.gymId, access.gymId), gte(gymClassesTable.date, today)));

    const enrolledClassIds = classes
      .filter(
        (cls) =>
          Array.isArray(cls.enrolledMemberIds) && cls.enrolledMemberIds.includes(callerUserId),
      )
      .map((cls) => String(cls.id));

    res.json({ classIds: enrolledClassIds });
  },
);

router.get(
  "/classes/waitlisted",
  requireApiAuth,
  async (req: Request, res: Response): Promise<void> => {
    const access = await requireApprovedAccess(req, res);
    if (!access) return;
    const callerUserId = access.userId;

    const today = new Date().toISOString().split("T")[0];
    const classes = await db
      .select({
        id: gymClassesTable.id,
        waitlistedMemberIds: gymClassesTable.waitlistedMemberIds,
      })
      .from(gymClassesTable)
      .where(and(eq(gymClassesTable.gymId, access.gymId), gte(gymClassesTable.date, today)));

    const waitlistedClassIds = classes
      .filter(
        (cls) =>
          Array.isArray(cls.waitlistedMemberIds) && cls.waitlistedMemberIds.includes(callerUserId),
      )
      .map((cls) => String(cls.id));

    res.json({ classIds: waitlistedClassIds });
  },
);

router.post(
  "/classes/:id/enroll",
  requireApiAuth,
  async (req: Request, res: Response): Promise<void> => {
    const access = await requireApprovedAccess(req, res);
    if (!access) return;
    const callerUserId = access.userId;

    const classId = parseClassId(req.params.id);
    if (classId === null) {
      res.status(400).json({ error: "Invalid class ID" });
      return;
    }

    try {
      const updated = await withLockedClass(classId, access.gymId, async (client, cls) => {
        const enrolledMemberIds = Array.isArray(cls.enrolledMemberIds) ? cls.enrolledMemberIds : [];
        const waitlistedMemberIds = Array.isArray(cls.waitlistedMemberIds)
          ? cls.waitlistedMemberIds
          : [];
        if (enrolledMemberIds.includes(callerUserId)) {
          return cls;
        }

        if (cls.enrolledCount >= cls.maxParticipants) {
          throw new RouteError(409, "Class is full");
        }

        return persistLockedClassRoster(
          client,
          classId,
          access.gymId,
          cls.enrolledCount + 1,
          [...enrolledMemberIds, callerUserId],
          waitlistedMemberIds.filter((memberId) => memberId !== callerUserId),
        );
      });

      if (!updated) {
        res.status(404).json({ error: "Class not found" });
        return;
      }

      res.json(serializeClass(updated));
    } catch (error) {
      if (isRouteError(error)) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }

      req.log.error({ error }, "Error enrolling in class");
      res.status(500).json({ error: "Failed to enroll in class" });
    }
  },
);

router.post(
  "/classes/:id/waitlist",
  requireApiAuth,
  async (req: Request, res: Response): Promise<void> => {
    const access = await requireApprovedAccess(req, res);
    if (!access) return;
    const callerUserId = access.userId;

    const classId = parseClassId(req.params.id);
    if (classId === null) {
      res.status(400).json({ error: "Invalid class ID" });
      return;
    }

    try {
      const updated = await withLockedClass(classId, access.gymId, async (client, cls) => {
        const enrolledMemberIds = Array.isArray(cls.enrolledMemberIds) ? cls.enrolledMemberIds : [];
        const waitlistedMemberIds = Array.isArray(cls.waitlistedMemberIds)
          ? cls.waitlistedMemberIds
          : [];

        if (enrolledMemberIds.includes(callerUserId)) {
          throw new RouteError(409, "Already enrolled in class");
        }

        if (cls.enrolledCount < cls.maxParticipants) {
          throw new RouteError(409, "Class has open spots");
        }

        if (waitlistedMemberIds.includes(callerUserId)) {
          return cls;
        }

        return persistLockedClassRoster(
          client,
          classId,
          access.gymId,
          cls.enrolledCount,
          enrolledMemberIds,
          [...waitlistedMemberIds, callerUserId],
        );
      });

      if (!updated) {
        res.status(404).json({ error: "Class not found" });
        return;
      }

      res.json(serializeClass(updated));
    } catch (error) {
      if (isRouteError(error)) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }

      req.log.error({ error }, "Error joining class waitlist");
      res.status(500).json({ error: "Failed to join class waitlist" });
    }
  },
);

router.delete(
  "/classes/:id/waitlist",
  requireApiAuth,
  async (req: Request, res: Response): Promise<void> => {
    const access = await requireApprovedAccess(req, res);
    if (!access) return;
    const callerUserId = access.userId;

    const classId = parseClassId(req.params.id);
    if (classId === null) {
      res.status(400).json({ error: "Invalid class ID" });
      return;
    }

    try {
      const updated = await withLockedClass(classId, access.gymId, async (client, cls) => {
        const enrolledMemberIds = Array.isArray(cls.enrolledMemberIds) ? cls.enrolledMemberIds : [];
        const waitlistedMemberIds = Array.isArray(cls.waitlistedMemberIds)
          ? cls.waitlistedMemberIds
          : [];

        if (!waitlistedMemberIds.includes(callerUserId)) {
          return cls;
        }

        return persistLockedClassRoster(
          client,
          classId,
          access.gymId,
          cls.enrolledCount,
          enrolledMemberIds,
          waitlistedMemberIds.filter((memberId) => memberId !== callerUserId),
        );
      });

      if (!updated) {
        res.status(404).json({ error: "Class not found" });
        return;
      }

      res.json(serializeClass(updated));
    } catch (error) {
      req.log.error({ error }, "Error leaving class waitlist");
      res.status(500).json({ error: "Failed to leave class waitlist" });
    }
  },
);

router.delete(
  "/classes/:id/enroll",
  requireApiAuth,
  async (req: Request, res: Response): Promise<void> => {
    const access = await requireApprovedAccess(req, res);
    if (!access) return;
    const callerUserId = access.userId;

    const classId = parseClassId(req.params.id);
    if (classId === null) {
      res.status(400).json({ error: "Invalid class ID" });
      return;
    }

    try {
      const updated = await withLockedClass(classId, access.gymId, async (client, cls) => {
        const enrolledMemberIds = Array.isArray(cls.enrolledMemberIds) ? cls.enrolledMemberIds : [];
        const waitlistedMemberIds = Array.isArray(cls.waitlistedMemberIds)
          ? cls.waitlistedMemberIds
          : [];
        if (!enrolledMemberIds.includes(callerUserId)) {
          return cls;
        }

        const nextMemberIds = enrolledMemberIds.filter((memberId) => memberId !== callerUserId);
        return persistLockedClassRoster(
          client,
          classId,
          access.gymId,
          Math.max(0, cls.enrolledCount - 1),
          nextMemberIds,
          waitlistedMemberIds,
        );
      });

      if (!updated) {
        res.status(404).json({ error: "Class not found" });
        return;
      }

      res.json(serializeClass(updated));
    } catch (error) {
      req.log.error({ error }, "Error leaving class");
      res.status(500).json({ error: "Failed to leave class" });
    }
  },
);

export default router;
