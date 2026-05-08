import { Router, type Request, type Response } from "express";
import { db, userProfiles } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getAuthenticatedClerkUser } from "../lib/clerk-request.ts";
import { requireApiAuth } from "../middlewares/apiAuth.ts";
import {
  displayNameForClerkUser,
  getPrimaryEmail,
  isUserRole,
  requireApprovedAccess,
  resolveUserAccessForClerkUser,
} from "../lib/user-access.ts";

const router = Router();

router.use(requireApiAuth);

router.get("/access-check", async (req: Request, res: Response) => {
  try {
    const identity = await getAuthenticatedClerkUser(req);
    if (!identity) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const clerkUser = identity.user;
    const access = await resolveUserAccessForClerkUser(clerkUser);

    if (!access.allowed) {
      res.json({
        status: access.status,
        email: access.email,
        gymId: access.gymId,
        role: access.role,
        message: access.message,
      });
      return;
    }

    if (!access.profile) {
      res.json({
        status: "missing_profile" as const,
        email: access.email,
        gymId: access.gymId,
        role: access.role,
      });
      return;
    }

    res.json({
      status: "ready" as const,
      email: access.email,
      gymId: access.gymId,
      name: access.profile.name,
      role: access.role,
    });
  } catch (err) {
    req.log.error({ err }, "Error checking profile access");
    res.status(500).json({ error: "Failed to check profile access" });
  }
});

router.post("/sync", async (req: Request, res: Response) => {
  try {
    const identity = await getAuthenticatedClerkUser(req);
    if (!identity) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { userId, user: clerkUser } = identity;

    const [existingProfile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.clerkId, userId))
      .limit(1);

    const access = await resolveUserAccessForClerkUser(clerkUser, existingProfile ?? null);

    if (!access.allowed) {
      res.status(403).json({
        error: access.message,
        status: access.status,
        email: access.email,
        gymId: access.gymId,
        role: access.role,
      });
      return;
    }

    const body = (req.body ?? {}) as { name?: string };
    const requestedName =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim().slice(0, 120)
        : undefined;
    const fallbackName = displayNameForClerkUser(clerkUser);
    const safeName = requestedName || existingProfile?.name?.trim() || fallbackName;

    const clerkRole = clerkUser.publicMetadata?.role;
    const safeRole =
      access.role ||
      (isUserRole(existingProfile?.role) && existingProfile.role) ||
      (isUserRole(clerkRole) && clerkRole) ||
      "member";

    const [profile] = await db
      .insert(userProfiles)
      .values({ clerkId: userId, gymId: access.gymId, name: safeName, role: safeRole })
      .onConflictDoUpdate({
        target: userProfiles.clerkId,
        set: { gymId: access.gymId, name: safeName, role: safeRole, updatedAt: new Date() },
      })
      .returning();
    res.json({ ...profile, email: getPrimaryEmail(clerkUser) });
  } catch (err) {
    req.log.error({ err }, "Error syncing profile");
    res.status(500).json({ error: "Failed to sync profile" });
  }
});

router.get("/me", async (req: Request, res: Response) => {
  try {
    const access = await requireApprovedAccess(req, res);
    if (!access) return;

    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.clerkId, access.userId))
      .limit(1);
    if (!profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    res.json(profile);
  } catch (err) {
    req.log.error({ err }, "Error fetching profile");
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

export default router;
