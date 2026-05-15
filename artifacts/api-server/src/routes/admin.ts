import { Router, type Request, type Response } from "express";
import { requireAuth } from "@clerk/express";
import { createClerkClient } from "@clerk/backend";
import { and, eq, desc, sum, count, gte, lte } from "drizzle-orm";
import { db, gymClassesTable, gymSettingsTable } from "@workspace/db";
import {
  AdminCreateClassBody,
  AdminUpdateClassBody,
  AdminUpdateClassParams,
  AdminDeleteClassParams,
  AdminUpdateSettingsBody,
} from "@workspace/api-zod";
import { resolveAdminAccess } from "../lib/admin-access.ts";
import {
  listAdminMembers,
  setAdminMemberAccess,
  updateAdminMemberRole,
} from "../lib/admin-members.ts";
import { isGrantableUserRole, normalizeEmail } from "../lib/user-access.ts";

const CLASS_COLORS: Record<string, string> = {
  Yoga: "#22C55E",
  Zumba: "#F59E0B",
  CrossFit: "#EF4444",
  HIIT: "#FF6B00",
  Spinning: "#3B82F6",
  Boxing: "#8B5CF6",
  Pilates: "#EC4899",
  Strength: "#F97316",
  Cardio: "#14B8A6",
  Other: "#9096B3",
};

const router = Router();

router.use(requireAuth());

function logRouteError(req: Request, err: unknown, message: string) {
  req.log?.error?.({ err }, message);
}

type ClerkUserSummary = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  emailAddresses: Array<{ emailAddress: string }>;
  publicMetadata?: Record<string, unknown>;
  createdAt: number;
};

type OwnerAccess = Extract<Awaited<ReturnType<typeof resolveAdminAccess>>, { allowed: true }>;
type AttendanceStatus = "booked" | "checked_in" | "no_show";
type AttendanceRecord = {
  memberId: string;
  status: AttendanceStatus;
  updatedAt: string;
  updatedBy: string | null;
};

const attendanceStatuses = new Set<AttendanceStatus>(["booked", "checked_in", "no_show"]);

function normalizeAttendanceRecords(value: unknown): AttendanceRecord[] {
  if (!Array.isArray(value)) return [];

  return value.filter((record): record is AttendanceRecord => {
    if (!record || typeof record !== "object") return false;
    const candidate = record as Partial<AttendanceRecord>;
    return (
      typeof candidate.memberId === "string" &&
      attendanceStatuses.has(candidate.status as AttendanceStatus) &&
      typeof candidate.updatedAt === "string"
    );
  });
}

async function requireOwner(req: Request, res: Response): Promise<OwnerAccess | null> {
  try {
    const access = await resolveAdminAccess(req);
    if (!access.allowed) {
      res.status(access.status).json({
        error: access.reason,
        email: access.email,
        role: access.role,
        allowlistConfigured: access.allowlistConfigured,
      });
      return null;
    }

    return access;
  } catch (err) {
    req.log.error({ err }, "Failed to verify owner role");
    res.status(500).json({ error: "Failed to verify access" });
    return null;
  }
}

router.get("/access", async (req: Request, res: Response): Promise<void> => {
  try {
    const access = await resolveAdminAccess(req);

    if (!access.allowed) {
      res.status(access.status).json({
        error: access.reason,
        email: access.email,
        role: access.role,
        allowlistConfigured: access.allowlistConfigured,
      });
      return;
    }

    res.json({
      ok: true,
      email: access.email,
      role: access.role,
      gymId: access.gymId,
      allowlistConfigured: access.allowlistConfigured,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to resolve admin access");
    res.status(500).json({ error: "Failed to verify access" });
  }
});

router.get("/classes", async (req: Request, res: Response): Promise<void> => {
  const access = await requireOwner(req, res);
  if (!access) return;
  const classes = await db
    .select()
    .from(gymClassesTable)
    .where(eq(gymClassesTable.gymId, access.gymId))
    .orderBy(gymClassesTable.date, gymClassesTable.startTime);
  res.json(classes.map(formatClass));
});

router.post("/classes", async (req: Request, res: Response): Promise<void> => {
  const access = await requireOwner(req, res);
  if (!access) return;

  const parsed = AdminCreateClassBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;
  const color = CLASS_COLORS[data.category] ?? CLASS_COLORS.Other;
  const newClassValues: typeof gymClassesTable.$inferInsert = {
    gymId: access.gymId,
    name: data.name,
    category: data.category,
    description: data.description ?? "",
    trainer: data.trainer,
    date: data.date,
    startTime: data.startTime,
    duration: data.duration,
    maxParticipants: data.maxParticipants,
    enrolledCount: 0,
    enrolledMemberIds: [],
    room: data.room ?? "",
    status: data.status ?? "scheduled",
    color,
  };

  const [newClass] = await db.insert(gymClassesTable).values(newClassValues).returning();

  res.status(201).json(formatClass(newClass));
});

router.put("/classes/:id", async (req: Request, res: Response): Promise<void> => {
  const access = await requireOwner(req, res);
  if (!access) return;

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = AdminUpdateClassParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = AdminUpdateClassBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Partial<typeof gymClassesTable.$inferInsert> = {};
  const data = parsed.data;
  if (data.name !== undefined) updates.name = data.name;
  if (data.category !== undefined) {
    updates.category = data.category;
    updates.color = CLASS_COLORS[data.category] ?? CLASS_COLORS.Other;
  }
  if (data.description !== undefined) updates.description = data.description;
  if (data.trainer !== undefined) updates.trainer = data.trainer;
  if (data.date !== undefined) updates.date = data.date;
  if (data.startTime !== undefined) updates.startTime = data.startTime;
  if (data.duration !== undefined) updates.duration = data.duration;
  if (data.maxParticipants !== undefined) updates.maxParticipants = data.maxParticipants;
  if (data.room !== undefined) updates.room = data.room;
  if (data.status !== undefined) updates.status = data.status;

  const [updated] = await db
    .update(gymClassesTable)
    .set(updates)
    .where(and(eq(gymClassesTable.id, params.data.id), eq(gymClassesTable.gymId, access.gymId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Class not found" });
    return;
  }

  res.json(formatClass(updated));
});

router.delete("/classes/:id", async (req: Request, res: Response): Promise<void> => {
  const access = await requireOwner(req, res);
  if (!access) return;

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = AdminDeleteClassParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(gymClassesTable)
    .where(and(eq(gymClassesTable.id, params.data.id), eq(gymClassesTable.gymId, access.gymId)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Class not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/settings", async (req: Request, res: Response): Promise<void> => {
  const access = await requireOwner(req, res);
  if (!access) return;

  const settings = await db
    .select()
    .from(gymSettingsTable)
    .where(eq(gymSettingsTable.gymId, access.gymId))
    .limit(1);

  if (settings.length === 0) {
    const [created] = await db
      .insert(gymSettingsTable)
      .values({
        gymId: access.gymId,
        gymName: access.gymId === "raghav2-padwar" ? "Raghav2 Padwar Gym" : "GymOS",
        address: "",
        phone: "",
        workingHours: "Mon-Fri: 6am-10pm, Sat-Sun: 7am-8pm",
        description: "Your premium fitness destination",
      })
      .returning();
    res.json(formatSettings(created));
    return;
  }

  res.json(formatSettings(settings[0]));
});

router.put("/settings", async (req: Request, res: Response): Promise<void> => {
  const access = await requireOwner(req, res);
  if (!access) return;

  const parsed = AdminUpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await db
    .select()
    .from(gymSettingsTable)
    .where(eq(gymSettingsTable.gymId, access.gymId))
    .limit(1);

  let result;
  if (existing.length === 0) {
    const [created] = await db
      .insert(gymSettingsTable)
      .values({
        gymId: access.gymId,
        gymName: parsed.data.gymName ?? "GymOS",
        address: parsed.data.address ?? "",
        phone: parsed.data.phone ?? "",
        workingHours: parsed.data.workingHours ?? "Mon-Fri: 6am-10pm, Sat-Sun: 7am-8pm",
        description: parsed.data.description ?? "",
      })
      .returning();
    result = created;
  } else {
    const [updated] = await db
      .update(gymSettingsTable)
      .set({
        ...(parsed.data.gymName !== undefined && { gymName: parsed.data.gymName }),
        ...(parsed.data.address !== undefined && { address: parsed.data.address }),
        ...(parsed.data.phone !== undefined && { phone: parsed.data.phone }),
        ...(parsed.data.workingHours !== undefined && { workingHours: parsed.data.workingHours }),
        ...(parsed.data.description !== undefined && { description: parsed.data.description }),
      })
      .where(and(eq(gymSettingsTable.id, existing[0].id), eq(gymSettingsTable.gymId, access.gymId)))
      .returning();
    result = updated;
  }

  res.json(formatSettings(result));
});

router.get("/members", async (req: Request, res: Response): Promise<void> => {
  const access = await requireOwner(req, res);
  if (!access) return;

  try {
    res.json(await listAdminMembers(process.env.CLERK_SECRET_KEY!, access.gymId));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch members from Clerk");
    res.status(500).json({ error: "Failed to fetch members" });
  }
});

router.post("/member-access", async (req: Request, res: Response): Promise<void> => {
  const access = await resolveAdminAccess(req);
  if (!access.allowed) {
    res.status(access.status).json({
      error: access.reason,
      email: access.email,
      role: access.role,
      allowlistConfigured: access.allowlistConfigured,
    });
    return;
  }

  const body = (req.body ?? {}) as {
    email?: string;
    role?: string;
    accessStatus?: string;
  };
  const email = normalizeEmail(body.email);
  const role = body.role ?? "member";
  const accessStatus = body.accessStatus;

  if (!email) {
    res.status(400).json({ error: "A valid email is required" });
    return;
  }

  if (!isGrantableUserRole(role)) {
    res.status(400).json({ error: "role must be member or trainer" });
    return;
  }

  if (accessStatus !== "approved" && accessStatus !== "revoked") {
    res.status(400).json({ error: "accessStatus must be approved or revoked" });
    return;
  }

  try {
    const member = await setAdminMemberAccess({
      gymId: access.gymId,
      email,
      role,
      accessStatus,
      createdByClerkId: access.userId,
      secretKey: process.env.CLERK_SECRET_KEY!,
    });
    res.json(member);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update member access";
    logRouteError(req, err, "Failed to update member access");
    res.status(message.includes("Owner accounts") ? 400 : 500).json({ error: message });
  }
});

router.patch("/members/:id", async (req: Request, res: Response): Promise<void> => {
  const access = await requireOwner(req, res);
  if (!access) return;

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const userId = typeof rawId === "string" ? rawId.trim() : "";

  if (!userId) {
    res.status(400).json({ error: "Member id is required" });
    return;
  }

  const body = (req.body ?? {}) as { role?: string };
  if (body.role !== "member" && body.role !== "trainer") {
    res.status(400).json({ error: "role must be member or trainer" });
    return;
  }

  try {
    res.json(
      await updateAdminMemberRole({
        gymId: access.gymId,
        userId,
        role: body.role,
        secretKey: process.env.CLERK_SECRET_KEY!,
      }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update member role";
    logRouteError(req, err, "Failed to update member role");
    res
      .status(
        message.includes("Owner accounts") || message.includes("valid primary email") ? 400 : 500,
      )
      .json({ error: message });
  }
});

router.get("/dashboard", async (req: Request, res: Response): Promise<void> => {
  const access = await requireOwner(req, res);
  if (!access) return;

  try {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const weekStart = startOfWeek.toISOString().split("T")[0];

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    const weekEnd = endOfWeek.toISOString().split("T")[0];

    // ⚡ Bolt: Use database-level aggregations instead of fetching all classes into memory
    const [[enrollmentsQuery], categoryStats, weeklyClassesQuery] = await Promise.all([
      db
        .select({ total: sum(gymClassesTable.enrolledCount) })
        .from(gymClassesTable)
        .where(eq(gymClassesTable.gymId, access.gymId)),
      db
        .select({ category: gymClassesTable.category, value: count() })
        .from(gymClassesTable)
        .where(eq(gymClassesTable.gymId, access.gymId))
        .groupBy(gymClassesTable.category)
        .orderBy(desc(count())),
      db
        .select({ date: gymClassesTable.date, value: count() })
        .from(gymClassesTable)
        .where(
          and(
            eq(gymClassesTable.gymId, access.gymId),
            gte(gymClassesTable.date, weekStart),
            lte(gymClassesTable.date, weekEnd)
          )
        )
        .groupBy(gymClassesTable.date)
    ]);

    const totalEnrollments = Number(enrollmentsQuery?.total ?? 0);
    const mostPopularCategory = categoryStats[0]?.category ?? "None";
    const totalClassesThisWeek = weeklyClassesQuery.reduce((acc, row) => acc + Number(row.value), 0);

    let totalActiveMembers = 0;
    try {
      totalActiveMembers = (
        await listAdminMembers(process.env.CLERK_SECRET_KEY!, access.gymId)
      ).filter((member) => member.accessStatus === "approved").length;
    } catch {
      totalActiveMembers = 0;
    }

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weeklyClassCounts = dayNames.map((day, idx) => {
      const dayDate = new Date(startOfWeek);
      dayDate.setDate(startOfWeek.getDate() + idx);
      const dateStr = dayDate.toISOString().split("T")[0];
      const dayStat = weeklyClassesQuery.find((r) => r.date === dateStr);
      return { day, count: Number(dayStat?.value ?? 0) };
    });

    res.json({
      totalClassesThisWeek,
      totalEnrollments,
      mostPopularCategory,
      totalActiveMembers,
      weeklyClassCounts,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to compute dashboard stats");
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
});

router.get("/classes/:id/enrollments", async (req: Request, res: Response): Promise<void> => {
  const access = await requireOwner(req, res);
  if (!access) return;

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid class ID" });
    return;
  }

  const [cls] = await db
    .select()
    .from(gymClassesTable)
    .where(and(eq(gymClassesTable.id, id), eq(gymClassesTable.gymId, access.gymId)))
    .limit(1);
  if (!cls) {
    res.status(404).json({ error: "Class not found" });
    return;
  }

  const memberIds: string[] = Array.isArray(cls.enrolledMemberIds) ? cls.enrolledMemberIds : [];
  const attendanceByMemberId = new Map(
    normalizeAttendanceRecords(cls.attendanceRecords).map((record) => [record.memberId, record]),
  );
  if (memberIds.length === 0) {
    res.json([]);
    return;
  }

  try {
    const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    const usersMap = new Map<string, ClerkUserSummary>();
    const chunkSize = 100;
    const uniqueMemberIds = Array.from(new Set(memberIds));
    for (let i = 0; i < uniqueMemberIds.length; i += chunkSize) {
      const chunk = uniqueMemberIds.slice(i, i + chunkSize);
      const { data } = await clerkClient.users.getUserList({ userId: chunk });
      for (const user of data) {
        usersMap.set(user.id, user as ClerkUserSummary);
      }
    }

    const responseMembers = memberIds.map((userId) => {
      const user = usersMap.get(userId);
      if (user) {
        return {
          id: user.id,
          firstName: user.firstName ?? null,
          lastName: user.lastName ?? null,
          email: user.emailAddresses[0]?.emailAddress ?? "",
          role: (user.publicMetadata?.role as string) ?? "member",
          attendanceStatus: attendanceByMemberId.get(userId)?.status ?? "booked",
        };
      }
      return {
        id: userId,
        firstName: null,
        lastName: null,
        email: "",
        role: "member",
        attendanceStatus: attendanceByMemberId.get(userId)?.status ?? "booked",
      };
    });

    res.json(responseMembers);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch enrolled members");
    res.status(500).json({ error: "Failed to fetch enrolled members" });
  }
});

router.patch(
  "/classes/:id/enrollments/:memberId",
  async (req: Request, res: Response): Promise<void> => {
    const access = await requireOwner(req, res);
    if (!access) return;

    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(rawId, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid class ID" });
      return;
    }

    const memberId = Array.isArray(req.params.memberId)
      ? req.params.memberId[0]
      : req.params.memberId;
    const attendanceStatus = req.body?.attendanceStatus as AttendanceStatus | undefined;
    if (!memberId || !attendanceStatus || !attendanceStatuses.has(attendanceStatus)) {
      res.status(400).json({ error: "Invalid attendance status" });
      return;
    }

    const [cls] = await db
      .select()
      .from(gymClassesTable)
      .where(and(eq(gymClassesTable.id, id), eq(gymClassesTable.gymId, access.gymId)))
      .limit(1);
    if (!cls) {
      res.status(404).json({ error: "Class not found" });
      return;
    }

    const memberIds: string[] = Array.isArray(cls.enrolledMemberIds) ? cls.enrolledMemberIds : [];
    if (!memberIds.includes(memberId)) {
      res.status(404).json({ error: "Member is not enrolled in this class" });
      return;
    }

    const updatedAt = new Date().toISOString();
    const nextAttendanceRecords = normalizeAttendanceRecords(cls.attendanceRecords).filter(
      (record) => record.memberId !== memberId,
    );
    if (attendanceStatus !== "booked") {
      nextAttendanceRecords.push({
        memberId,
        status: attendanceStatus,
        updatedAt,
        updatedBy: access.userId,
      });
    }

    const [updatedClass] = await db
      .update(gymClassesTable)
      .set({ attendanceRecords: nextAttendanceRecords, updatedAt: new Date() })
      .where(and(eq(gymClassesTable.id, id), eq(gymClassesTable.gymId, access.gymId)))
      .returning();

    if (!updatedClass) {
      res.status(404).json({ error: "Class not found" });
      return;
    }

    res.json({ memberId, attendanceStatus, updatedAt });
  },
);

function formatClass(cls: typeof gymClassesTable.$inferSelect) {
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
    enrolledMemberIds: Array.isArray(cls.enrolledMemberIds) ? cls.enrolledMemberIds : [],
    waitlistedCount: waitlistedMemberIds.length,
    room: cls.room,
    status: cls.status,
    color: cls.color,
    createdAt: cls.createdAt.toISOString(),
    updatedAt: cls.updatedAt.toISOString(),
  };
}

function formatSettings(s: typeof gymSettingsTable.$inferSelect) {
  return {
    id: s.id,
    gymName: s.gymName,
    address: s.address,
    phone: s.phone,
    workingHours: s.workingHours,
    description: s.description,
    updatedAt: s.updatedAt.toISOString(),
  };
}

export default router;
