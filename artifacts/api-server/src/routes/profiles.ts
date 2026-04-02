import { Router, type Request, type Response } from "express";
import { requireAuth, getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { userProfiles, userRoleEnum } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.use(requireAuth());

router.post("/sync", async (req: Request, res: Response) => {
  try {
    const auth = getAuth(req);
    const userId = auth.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { name, role } = req.body as { name?: string; role?: string };
    if (!name || typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    const safeRole = userRoleEnum.includes(role as (typeof userRoleEnum)[number])
      ? (role as (typeof userRoleEnum)[number])
      : "member";

    const [profile] = await db
      .insert(userProfiles)
      .values({ clerkId: userId, name: name.trim(), role: safeRole })
      .onConflictDoUpdate({
        target: userProfiles.clerkId,
        set: { name: name.trim(), role: safeRole, updatedAt: new Date() },
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
