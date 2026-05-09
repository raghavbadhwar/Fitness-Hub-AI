import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { createClerkClient } from "@clerk/backend";
import { and, eq } from "drizzle-orm";
import { adminAuditLogs, db, gymClassesTable, gymSettingsTable } from "@workspace/db";
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
import { setRequestLogContext } from "../lib/logger.ts";
import { requireApiAuth } from "../middlewares/apiAuth.ts";
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

router.use(requireApiAuth);

const DASHBOARD_MEMBER_COUNT_CACHE_TTL_MS = 5 * 60 * 1_000;
const dashboardMemberCountCache = new Map<string, { value: number; expiresAt: number }>();

export function clearDashboardMemberCountCache(gymId?: string) {
  if (gymId) {
    dashboardMemberCountCache.delete(gymId);
    return;
  }

  dashboardMemberCountCache.clear();
}

function logRouteError(req: Request, err: unknown, message: string) {
  req.log?.error?.({ err }, message);
}

function logAdminAccessDenied(
  req: Request,
  access: Extract<Awaited<ReturnType<typeof resolveAdminAccess>>, { allowed: false }>,
  route: string,
) {
  req.log?.warn?.(
    {
      route,
      userId: access.userId,
      role: access.role,
      statusCode: access.status,
      allowlistConfigured: access.allowlistConfigured,
    },
    "Admin access denied",
  );
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
type AuditMetadata = Record<string, unknown>;
type AttendanceRecord = {
  memberId: string;
  status: AttendanceStatus;
  updatedAt: string;
  updatedBy: string | null;
};
type DashboardClassRow = {
  id: number;
  name: string;
  category: string;
  date: string;
  startTime: string;
  maxParticipants: number;
  enrolledCount: number;
  status: string;
};

const attendanceStatuses = new Set<AttendanceStatus>(["booked", "checked_in", "no_show"]);
const LOW_ATTENDANCE_OCCUPANCY_THRESHOLD = 35;
const AUDIT_METADATA_SENSITIVE_KEY_RE =
  /(authorization|bearer|cookie|password|secret|token|api[_-]?key|session)/i;

function getDateKey(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function getDashboardWeekBounds(now = new Date(Date.now())) {
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  return {
    weekStart: getDateKey(startOfWeek),
    weekEnd: getDateKey(endOfWeek),
    today: getDateKey(now),
    startOfWeek,
  };
}

function isOperationalClass(gymClass: Pick<DashboardClassRow, "status">) {
  return gymClass.status !== "cancelled";
}

function getClassOccupancyPercent(
  gymClass: Pick<DashboardClassRow, "enrolledCount" | "maxParticipants">,
) {
  if (gymClass.maxParticipants <= 0) return 0;
  return Math.round((gymClass.enrolledCount / gymClass.maxParticipants) * 100);
}

function getAverageOccupancyPercent(classes: DashboardClassRow[]) {
  const capacityClasses = classes.filter((gymClass) => gymClass.maxParticipants > 0);
  const totalCapacity = capacityClasses.reduce(
    (sum, gymClass) => sum + gymClass.maxParticipants,
    0,
  );
  if (totalCapacity <= 0) return 0;

  const totalEnrolled = capacityClasses.reduce((sum, gymClass) => sum + gymClass.enrolledCount, 0);
  return Math.round((totalEnrolled / totalCapacity) * 100);
}

function getMostPopularCategory(classes: DashboardClassRow[]) {
  const categoryEnrollmentCounts: Record<string, number> = {};
  const categoryClassCounts: Record<string, number> = {};

  for (const gymClass of classes) {
    categoryEnrollmentCounts[gymClass.category] =
      (categoryEnrollmentCounts[gymClass.category] ?? 0) + gymClass.enrolledCount;
    categoryClassCounts[gymClass.category] = (categoryClassCounts[gymClass.category] ?? 0) + 1;
  }

  return (
    Object.keys(categoryClassCounts).sort((left, right) => {
      const enrollmentDelta =
        (categoryEnrollmentCounts[right] ?? 0) - (categoryEnrollmentCounts[left] ?? 0);
      if (enrollmentDelta !== 0) return enrollmentDelta;

      const classDelta = (categoryClassCounts[right] ?? 0) - (categoryClassCounts[left] ?? 0);
      if (classDelta !== 0) return classDelta;

      return left.localeCompare(right);
    })[0] ?? "None"
  );
}

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

function sanitizeAuditMetadata(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeAuditMetadata).slice(0, 50);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const sanitized: AuditMetadata = {};
  for (const [key, entry] of Object.entries(value as AuditMetadata)) {
    if (AUDIT_METADATA_SENSITIVE_KEY_RE.test(key)) {
      continue;
    }
    sanitized[key] = sanitizeAuditMetadata(entry);
  }
  return sanitized;
}

async function writeAdminAuditLog(
  access: OwnerAccess,
  event: {
    action: string;
    targetType: string;
    targetId?: string | number | null;
    metadata?: AuditMetadata;
  },
) {
  await db
    .insert(adminAuditLogs)
    .values({
      id: randomUUID(),
      gymId: access.gymId,
      actorClerkId: access.userId,
      action: event.action,
      targetType: event.targetType,
      targetId:
        typeof event.targetId === "number" ? String(event.targetId) : (event.targetId ?? null),
      metadata: sanitizeAuditMetadata(event.metadata ?? {}) as AuditMetadata,
    })
    .returning();
}

function formatAuditLog(log: typeof adminAuditLogs.$inferSelect) {
  return {
    id: log.id,
    gymId: log.gymId,
    actorClerkId: log.actorClerkId,
    action: log.action,
    targetType: log.targetType,
    targetId: log.targetId ?? null,
    metadata: sanitizeAuditMetadata(log.metadata ?? {}) as AuditMetadata,
    createdAt: log.createdAt.toISOString(),
  };
}

function changedFields(data: Record<string, unknown>) {
  return Object.keys(data).filter((key) => data[key] !== undefined);
}

async function requireOwner(req: Request, res: Response): Promise<OwnerAccess | null> {
  try {
    const access = await resolveAdminAccess(req);
    setRequestLogContext(res, {
      userId: access.userId,
      gymId: access.gymId,
      role: access.role,
    });
    if (!access.allowed) {
      logAdminAccessDenied(req, access, "admin.requireOwner");
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

async function getDashboardActiveMemberCount(secretKey: string, gymId: string): Promise<number> {
  const now = Date.now();
  const cached = dashboardMemberCountCache.get(gymId);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  try {
    const value = (await listAdminMembers(secretKey, gymId)).filter(
      (member) => member.accessStatus === "approved",
    ).length;
    dashboardMemberCountCache.set(gymId, {
      value,
      expiresAt: now + DASHBOARD_MEMBER_COUNT_CACHE_TTL_MS,
    });
    return value;
  } catch (error) {
    if (cached) {
      return cached.value;
    }

    throw error;
  }
}

router.get("/access", async (req: Request, res: Response): Promise<void> => {
  try {
    const access = await resolveAdminAccess(req);
    setRequestLogContext(res, {
      userId: access.userId,
      gymId: access.gymId,
      role: access.role,
    });

    if (!access.allowed) {
      logAdminAccessDenied(req, access, "admin.access");
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
  await writeAdminAuditLog(access, {
    action: "class.create",
    targetType: "class",
    targetId: newClass.id,
    metadata: {
      name: newClass.name,
      category: newClass.category,
      date: newClass.date,
      status: newClass.status,
    },
  });

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

  await writeAdminAuditLog(access, {
    action: "class.update",
    targetType: "class",
    targetId: updated.id,
    metadata: {
      changedFields: changedFields(data as Record<string, unknown>),
      status: updated.status,
    },
  });

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

  await writeAdminAuditLog(access, {
    action: "class.delete",
    targetType: "class",
    targetId: deleted.id,
    metadata: {
      name: deleted.name,
      date: deleted.date,
      status: deleted.status,
    },
  });

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

  await writeAdminAuditLog(access, {
    action: existing.length === 0 ? "settings.create" : "settings.update",
    targetType: "settings",
    targetId: result.id,
    metadata: {
      changedFields: changedFields(parsed.data as Record<string, unknown>),
      created: existing.length === 0,
    },
  });

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
    logAdminAccessDenied(req, access, "admin.memberAccess");
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
    await writeAdminAuditLog(access, {
      action: accessStatus === "approved" ? "access.grant" : "access.revoke",
      targetType: "member_access",
      targetId: email,
      metadata: {
        email,
        role,
        accessStatus,
      },
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
    const member = await updateAdminMemberRole({
      gymId: access.gymId,
      userId,
      role: body.role,
      secretKey: process.env.CLERK_SECRET_KEY!,
    });
    await writeAdminAuditLog(access, {
      action: "member.role.update",
      targetType: "member",
      targetId: userId,
      metadata: {
        role: body.role,
        email: member.email,
      },
    });
    res.json(member);
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

router.get("/audit-logs", async (req: Request, res: Response): Promise<void> => {
  const access = await requireOwner(req, res);
  if (!access) return;

  const rawLimit = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
  const parsedLimit = Number.parseInt(String(rawLimit ?? "50"), 10);
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 50;

  const logs = await db.select().from(adminAuditLogs).where(eq(adminAuditLogs.gymId, access.gymId));

  res.json(
    logs
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .slice(0, limit)
      .map(formatAuditLog),
  );
});

router.get("/dashboard", async (req: Request, res: Response): Promise<void> => {
  const access = await requireOwner(req, res);
  if (!access) return;

  try {
    const { weekStart, weekEnd, today, startOfWeek } = getDashboardWeekBounds();

    const allClasses = await db
      .select()
      .from(gymClassesTable)
      .where(eq(gymClassesTable.gymId, access.gymId));
    const operationalClasses = allClasses.filter(isOperationalClass);
    const thisWeekClasses = operationalClasses.filter(
      (gymClass) => gymClass.date >= weekStart && gymClass.date <= weekEnd,
    );
    const upcomingClasses = operationalClasses.filter((gymClass) => gymClass.date >= today);

    const totalClassesThisWeek = thisWeekClasses.length;
    const totalEnrollments = allClasses.reduce((sum, c) => sum + c.enrolledCount, 0);
    const totalEnrollmentsThisWeek = thisWeekClasses.reduce(
      (sum, gymClass) => sum + gymClass.enrolledCount,
      0,
    );
    const averageClassOccupancy = getAverageOccupancyPercent(thisWeekClasses);
    const upcomingClassesCount = upcomingClasses.length;
    const lowAttendanceClasses = upcomingClasses
      .filter(
        (gymClass) =>
          gymClass.maxParticipants > 0 &&
          getClassOccupancyPercent(gymClass) <= LOW_ATTENDANCE_OCCUPANCY_THRESHOLD,
      )
      .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`))
      .slice(0, 5)
      .map((gymClass) => ({
        id: gymClass.id,
        name: gymClass.name,
        date: gymClass.date,
        startTime: gymClass.startTime,
        enrolledCount: gymClass.enrolledCount,
        maxParticipants: gymClass.maxParticipants,
        occupancyPercent: getClassOccupancyPercent(gymClass),
      }));
    const mostPopularCategory = getMostPopularCategory(operationalClasses);

    let totalActiveMembers = 0;
    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    if (clerkSecretKey) {
      try {
        totalActiveMembers = await getDashboardActiveMemberCount(clerkSecretKey, access.gymId);
      } catch (err) {
        req.log?.warn?.({ err }, "Failed to fetch dashboard member count");
        totalActiveMembers = 0;
      }
    }

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weeklyClassCounts = dayNames.map((day, idx) => {
      const dayDate = new Date(startOfWeek);
      dayDate.setDate(startOfWeek.getDate() + idx);
      const dateStr = dayDate.toISOString().split("T")[0];
      const dayCount = allClasses.filter((c) => c.date === dateStr).length;
      return { day, count: dayCount };
    });

    res.json({
      totalClassesThisWeek,
      totalEnrollments,
      totalEnrollmentsThisWeek,
      averageClassOccupancy,
      upcomingClassesCount,
      mostPopularCategory,
      totalActiveMembers,
      lowAttendanceClasses,
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

    await writeAdminAuditLog(access, {
      action: "class.attendance.update",
      targetType: "class",
      targetId: id,
      metadata: {
        memberId,
        attendanceStatus,
      },
    });

    res.json({ memberId, attendanceStatus, updatedAt });
  },
);

function formatClass(cls: typeof gymClassesTable.$inferSelect) {
  const waitlistedMemberIds = Array.isArray(cls.waitlistedMemberIds) ? cls.waitlistedMemberIds : [];
  const attendanceRecords = normalizeAttendanceRecords(cls.attendanceRecords);
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
    checkedInCount: attendanceRecords.filter((record) => record.status === "checked_in").length,
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
