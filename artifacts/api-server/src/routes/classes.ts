import { Router, type Request, type Response } from "express";
import { getAuth, requireAuth } from "@clerk/express";
import { eq, gte } from "drizzle-orm";
import { db, gymClassesTable, pool } from "@workspace/db";

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
): Promise<typeof gymClassesTable.$inferSelect | null> {
  const result = await client.query<LockedClassRow>(
    `SELECT
        id,
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
        room,
        status,
        color,
        created_at,
        updated_at
      FROM gym_classes
      WHERE id = $1
      FOR UPDATE`,
    [classId],
  );

  return result.rows[0] ? hydrateLockedClass(result.rows[0]) : null;
}

async function persistLockedClass(
  client: PoolClient,
  classId: number,
  enrolledCount: number,
  enrolledMemberIds: string[],
) {
  const result = await client.query<LockedClassRow>(
    `UPDATE gym_classes
      SET enrolled_count = $2,
          enrolled_member_ids = $3::jsonb,
          updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
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
        room,
        status,
        color,
        created_at,
        updated_at`,
    [classId, enrolledCount, JSON.stringify(enrolledMemberIds)],
  );

  return hydrateLockedClass(result.rows[0]);
}

async function withLockedClass(
  classId: number,
  mutate: (
    client: PoolClient,
    cls: typeof gymClassesTable.$inferSelect,
  ) => Promise<typeof gymClassesTable.$inferSelect>,
) {
  const client = await (pool.connect() as Promise<PoolClient>);

  try {
    await client.query("BEGIN");
    const cls = await loadLockedClass(client, classId);
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

router.get("/classes", async (_req: Request, res: Response): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];
  const classes = await db
    .select()
    .from(gymClassesTable)
    .where(gte(gymClassesTable.date, today))
    .orderBy(gymClassesTable.date, gymClassesTable.startTime);

  res.json(classes.map(serializeClass));
});

router.get(
  "/classes/enrolled",
  requireAuth(),
  async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(req);
    const callerUserId = auth.userId;
    if (!callerUserId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    const classes = await db
      .select({
        id: gymClassesTable.id,
        enrolledMemberIds: gymClassesTable.enrolledMemberIds,
      })
      .from(gymClassesTable)
      .where(gte(gymClassesTable.date, today));

    const enrolledClassIds = classes
      .filter(
        (cls) =>
          Array.isArray(cls.enrolledMemberIds) && cls.enrolledMemberIds.includes(callerUserId),
      )
      .map((cls) => String(cls.id));

    res.json({ classIds: enrolledClassIds });
  },
);

router.post(
  "/classes/:id/enroll",
  requireAuth(),
  async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(req);
    const callerUserId = auth.userId;
    if (!callerUserId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const classId = parseInt(rawId, 10);
    if (isNaN(classId)) {
      res.status(400).json({ error: "Invalid class ID" });
      return;
    }

    try {
      const updated = await withLockedClass(classId, async (client, cls) => {
        const enrolledMemberIds = Array.isArray(cls.enrolledMemberIds) ? cls.enrolledMemberIds : [];
        if (enrolledMemberIds.includes(callerUserId)) {
          return cls;
        }

        if (cls.enrolledCount >= cls.maxParticipants) {
          throw new RouteError(409, "Class is full");
        }

        return persistLockedClass(client, classId, cls.enrolledCount + 1, [
          ...enrolledMemberIds,
          callerUserId,
        ]);
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

      console.error("Error enrolling in class:", error);
      res.status(500).json({ error: "Failed to enroll in class" });
    }
  },
);

router.delete(
  "/classes/:id/enroll",
  requireAuth(),
  async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(req);
    const callerUserId = auth.userId;
    if (!callerUserId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const classId = parseInt(rawId, 10);
    if (isNaN(classId)) {
      res.status(400).json({ error: "Invalid class ID" });
      return;
    }

    try {
      const updated = await withLockedClass(classId, async (client, cls) => {
        const enrolledMemberIds = Array.isArray(cls.enrolledMemberIds) ? cls.enrolledMemberIds : [];
        if (!enrolledMemberIds.includes(callerUserId)) {
          return cls;
        }

        const nextMemberIds = enrolledMemberIds.filter((memberId) => memberId !== callerUserId);
        return persistLockedClass(
          client,
          classId,
          Math.max(0, cls.enrolledCount - 1),
          nextMemberIds,
        );
      });

      if (!updated) {
        res.status(404).json({ error: "Class not found" });
        return;
      }

      res.json(serializeClass(updated));
    } catch (error) {
      console.error("Error leaving class:", error);
      res.status(500).json({ error: "Failed to leave class" });
    }
  },
);

export default router;
