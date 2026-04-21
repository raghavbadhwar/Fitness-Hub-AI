import { Router, type Request, type Response } from "express";
import { requireAuth, getAuth } from "@clerk/express";
import { createClerkClient } from "@clerk/backend";
import { db } from "@workspace/db";
import { userProfiles, userRoleEnum, type UserRole } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.use(requireAuth());

function isUserRole(value: unknown): value is UserRole {
  return userRoleEnum.includes(value as UserRole);
}

router.get("/access-check", async (req: Request, res: Response) => {
  try {
    const auth = getAuth(req);
    const userId = auth.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const [profile] = await db
      .select({
        name: userProfiles.name,
        role: userProfiles.role,
      })
      .from(userProfiles)
      .where(eq(userProfiles.clerkId, userId))
      .limit(1);

    if (!profile) {
      res.json({ status: "missing_profile" as const });
      return;
    }

    res.json({
      status: "ready" as const,
      name: profile.name,
      role: profile.role,
    });
  } catch (err) {
    console.error("Error checking profile access:", err);
    res.status(500).json({ error: "Failed to check profile access" });
  }
});

router.post("/sync", async (req: Request, res: Response) => {
  try {
    const auth = getAuth(req);
    const userId = auth.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const [existingProfile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.clerkId, userId))
      .limit(1);

    const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    const clerkUser = await clerkClient.users.getUser(userId);

    const body = (req.body ?? {}) as { name?: string };
    const requestedName =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim().slice(0, 120)
        : undefined;
    const fallbackName =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() ||
      clerkUser.emailAddresses[0]?.emailAddress?.split("@")[0]?.trim() ||
      "User";
    const safeName =
      requestedName ||
      existingProfile?.name?.trim() ||
      fallbackName;

    const clerkRole = clerkUser.publicMetadata?.role;
    const safeRole =
      (isUserRole(clerkRole) && clerkRole) ||
      (isUserRole(existingProfile?.role) && existingProfile.role) ||
      "member";

    const [profile] = await db
      .insert(userProfiles)
      .values({ clerkId: userId, name: safeName, role: safeRole })
      .onConflictDoUpdate({
        target: userProfiles.clerkId,
        set: { name: safeName, role: safeRole, updatedAt: new Date() },
      })
      .returning();
    res.json(profile);
  } catch (err) {
    console.error("Error syncing profile:", err);
    res.status(500).json({ error: "Failed to sync profile" });
  }
});

router.get("/me", async (req: Request, res: Response) => {
  try {
    const auth = getAuth(req);
    const userId = auth.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.clerkId, userId))
      .limit(1);
    if (!profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    res.json(profile);
  } catch (err) {
    console.error("Error fetching profile:", err);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

export default router;
