import { Router, type Request, type Response } from "express";
import { requireAuth } from "@clerk/express";
import { createClerkClient } from "@clerk/backend";
import { eq, gte, count, sum } from "drizzle-orm";
import {
  db,
  gymClassesTable,
  gymSettingsTable,
  memberAiProfiles,
  userProfiles,
  userRoleEnum,
  type UserRole,
} from "@workspace/db";
import {
  AdminCreateClassBody,
  AdminUpdateClassBody,
  AdminUpdateClassParams,
  AdminDeleteClassParams,
  AdminUpdateSettingsBody,
} from "@workspace/api-zod";
import { resolveAdminAccess } from "../lib/admin-access.ts";

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

function isUserRole(value: unknown): value is UserRole {
  return userRoleEnum.includes(value as UserRole);
}

type AdminMemberPayload = {
  id: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: UserRole;
  createdAt: string;
  aiMemorySummary: string | null;
  aiLastUpdatedAt: string | null;
  aiRecentMessageCount: number;
};

type ClerkUserSummary = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  emailAddresses: Array<{ emailAddress: string }>;
  publicMetadata?: Record<string, unknown>;
  createdAt: number;
};

async function listAllClerkUsers(secretKey: string): Promise<ClerkUserSummary[]> {
  const clerkClient = createClerkClient({ secretKey });
  const users: ClerkUserSummary[] = [];
  const pageSize = 200;
  let offset = 0;

  while (true) {
    const { data } = await clerkClient.users.getUserList({
      limit: pageSize,
      offset,
    });

    users.push(...(data as ClerkUserSummary[]));

    if (data.length < pageSize) {
      return users;
    }

    offset += data.length;
  }
}

function buildAdminMemberPayload(
  user: ClerkUserSummary,
  profile?: { name: string; role: string } | undefined,
  aiProfile?:
    | {
        memorySummary: string;
        updatedAt: Date;
        recentMessages: unknown;
      }
    | undefined,
): AdminMemberPayload {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  const resolvedName = profile?.name?.trim() || fullName || null;
  const metadataRole = user.publicMetadata?.role;
  const recentMessageCount = Array.isArray(aiProfile?.recentMessages)
    ? aiProfile.recentMessages.length
    : 0;

  return {
    id: user.id,
    name: resolvedName,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    email: user.emailAddresses[0]?.emailAddress ?? "",
    role:
      (isUserRole(profile?.role) && profile.role) ||
      (isUserRole(metadataRole) && metadataRole) ||
      "member",
    createdAt: new Date(user.createdAt).toISOString(),
    aiMemorySummary: aiProfile?.memorySummary?.trim() || null,
    aiLastUpdatedAt: aiProfile?.updatedAt?.toISOString() ?? null,
    aiRecentMessageCount: recentMessageCount,
  };
}

async function requireOwner(req: Request, res: Response): Promise<boolean> {
  try {
    const access = await resolveAdminAccess(req);
    if (!access.allowed) {
      res.status(access.status).json({
        error: access.reason,
        email: access.email,
        role: access.role,
        allowlistConfigured: access.allowlistConfigured,
      });
      return false;
    }

    return true;
  } catch (err) {
    req.log.error({ err }, "Failed to verify owner role");
    res.status(500).json({ error: "Failed to verify access" });
    return false;
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
      allowlistConfigured: access.allowlistConfigured,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to resolve admin access");
    res.status(500).json({ error: "Failed to verify access" });
  }
});

router.get("/classes", async (req: Request, res: Response): Promise<void> => {
  if (!(await requireOwner(req, res))) return;
  const classes = await db
    .select()
    .from(gymClassesTable)
    .orderBy(gymClassesTable.date, gymClassesTable.startTime);
  res.json(classes.map(formatClass));
});

router.post("/classes", async (req: Request, res: Response): Promise<void> => {
  if (!(await requireOwner(req, res))) return;

  const parsed = AdminCreateClassBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;
  const color = CLASS_COLORS[data.category] ?? CLASS_COLORS.Other;
  const newClassValues: typeof gymClassesTable.$inferInsert = {
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
  if (!(await requireOwner(req, res))) return;

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
    .where(eq(gymClassesTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Class not found" });
    return;
  }

  res.json(formatClass(updated));
});

router.delete("/classes/:id", async (req: Request, res: Response): Promise<void> => {
  if (!(await requireOwner(req, res))) return;

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = AdminDeleteClassParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(gymClassesTable)
    .where(eq(gymClassesTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Class not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/settings", async (req: Request, res: Response): Promise<void> => {
  if (!(await requireOwner(req, res))) return;

  const settings = await db.select().from(gymSettingsTable).limit(1);

  if (settings.length === 0) {
    const [created] = await db
      .insert(gymSettingsTable)
      .values({
        gymName: "GymOS",
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
  if (!(await requireOwner(req, res))) return;

  const parsed = AdminUpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await db.select().from(gymSettingsTable).limit(1);

  let result;
  if (existing.length === 0) {
    const [created] = await db
      .insert(gymSettingsTable)
      .values({
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
      .where(eq(gymSettingsTable.id, existing[0].id))
      .returning();
    result = updated;
  }

  res.json(formatSettings(result));
});

router.get("/members", async (req: Request, res: Response): Promise<void> => {
  if (!(await requireOwner(req, res))) return;

  try {
    const users = await listAllClerkUsers(process.env.CLERK_SECRET_KEY!);
    const [profiles, aiProfiles] = await Promise.all([
      db.select().from(userProfiles),
      db.select().from(memberAiProfiles),
    ]);
    const profileMap = new Map(profiles.map((profile) => [profile.clerkId, profile]));
    const aiProfileMap = new Map(aiProfiles.map((profile) => [profile.memberClerkId, profile]));

    const members = users
      .map((user) =>
        buildAdminMemberPayload(user, profileMap.get(user.id), aiProfileMap.get(user.id)),
      )
      .sort((left, right) => {
        const leftName = (left.name || left.email).toLowerCase();
        const rightName = (right.name || right.email).toLowerCase();
        return leftName.localeCompare(rightName);
      });

    res.json(members);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch members from Clerk");
    res.status(500).json({ error: "Failed to fetch members" });
  }
});

router.patch("/members/:id", async (req: Request, res: Response): Promise<void> => {
  if (!(await requireOwner(req, res))) return;

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
    const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    const user = await clerkClient.users.getUser(userId);
    const [existingProfile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.clerkId, userId))
      .limit(1);

    const currentRole =
      (isUserRole(existingProfile?.role) && existingProfile.role) ||
      (isUserRole(user.publicMetadata?.role) && user.publicMetadata.role) ||
      "member";

    if (currentRole === "owner") {
      res.status(400).json({ error: "Owner accounts must be managed separately" });
      return;
    }

    const nextName =
      existingProfile?.name?.trim() ||
      [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
      user.emailAddresses[0]?.emailAddress?.split("@")[0]?.trim() ||
      "User";

    const previousPublicMetadata = { ...user.publicMetadata };
    await clerkClient.users.updateUser(userId, {
      publicMetadata: {
        ...previousPublicMetadata,
        role: body.role,
      },
    });

    let updatedProfile;
    try {
      [updatedProfile] = await db
        .insert(userProfiles)
        .values({
          clerkId: userId,
          name: nextName,
          role: body.role,
        })
        .onConflictDoUpdate({
          target: userProfiles.clerkId,
          set: {
            name: nextName,
            role: body.role,
            updatedAt: new Date(),
          },
        })
        .returning();
    } catch (dbError) {
      try {
        await clerkClient.users.updateUser(userId, {
          publicMetadata: previousPublicMetadata,
        });
      } catch (rollbackError) {
        req.log.error(
          { rollbackError, userId },
          "Failed to rollback Clerk role after database error",
        );
      }

      throw dbError;
    }

    const [aiProfile] = await db
      .select()
      .from(memberAiProfiles)
      .where(eq(memberAiProfiles.memberClerkId, userId))
      .limit(1);

    const updatedUser: ClerkUserSummary = {
      ...user,
      publicMetadata: {
        ...previousPublicMetadata,
        role: body.role,
      },
    };

    res.json(buildAdminMemberPayload(updatedUser, updatedProfile, aiProfile));
  } catch (err) {
    req.log.error({ err }, "Failed to update member role");
    res.status(500).json({ error: "Failed to update member role" });
  }
});

router.get("/dashboard", async (req: Request, res: Response): Promise<void> => {
  if (!(await requireOwner(req, res))) return;

  try {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const weekStart = startOfWeek.toISOString().split("T")[0];

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    const weekEnd = endOfWeek.toISOString().split("T")[0];

    const allClasses = await db.select().from(gymClassesTable);
    const thisWeekClasses = allClasses.filter((c) => c.date >= weekStart && c.date <= weekEnd);

    const totalClassesThisWeek = thisWeekClasses.length;
    const totalEnrollments = allClasses.reduce((sum, c) => sum + c.enrolledCount, 0);

    const categoryCounts: Record<string, number> = {};
    for (const c of allClasses) {
      categoryCounts[c.category] = (categoryCounts[c.category] ?? 0) + 1;
    }
    const mostPopularCategory =
      Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "None";

    let totalActiveMembers = 0;
    try {
      const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
      totalActiveMembers = await clerkClient.users.getCount();
    } catch {
      totalActiveMembers = 0;
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
  if (!(await requireOwner(req, res))) return;

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid class ID" });
    return;
  }

  const [cls] = await db.select().from(gymClassesTable).where(eq(gymClassesTable.id, id)).limit(1);
  if (!cls) {
    res.status(404).json({ error: "Class not found" });
    return;
  }

  const memberIds: string[] = Array.isArray(cls.enrolledMemberIds) ? cls.enrolledMemberIds : [];
  if (memberIds.length === 0) {
    res.json([]);
    return;
  }

  try {
    const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    const members = await Promise.all(
      memberIds.map(async (userId) => {
        try {
          const user = await clerkClient.users.getUser(userId);
          return {
            id: user.id,
            firstName: user.firstName ?? null,
            lastName: user.lastName ?? null,
            email: user.emailAddresses[0]?.emailAddress ?? "",
            role: (user.publicMetadata?.role as string) ?? "member",
          };
        } catch {
          return { id: userId, firstName: null, lastName: null, email: "", role: "member" };
        }
      }),
    );
    res.json(members);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch enrolled members");
    res.status(500).json({ error: "Failed to fetch enrolled members" });
  }
});

function formatClass(cls: typeof gymClassesTable.$inferSelect) {
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
