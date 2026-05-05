import { Router, type Request, type Response } from "express";
import { requireAuth, getAuth } from "@clerk/express";
import { createClerkClient } from "@clerk/backend";
import { db } from "@workspace/db";
import {
  workoutTemplates,
  workoutAssignments,
  userProfiles,
  type TemplateExercise,
} from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";

const router = Router();

router.use(requireAuth());

async function requireTrainerOrOwner(
  req: Request,
  res: Response,
): Promise<string | null> {
  const auth = getAuth(req);
  const userId = auth.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  const [profile] = await db
    .select({ role: userProfiles.role })
    .from(userProfiles)
    .where(eq(userProfiles.clerkId, userId))
    .limit(1);
  if (!profile || (profile.role !== "trainer" && profile.role !== "owner")) {
    res
      .status(403)
      .json({ error: "Only trainers and owners can perform this action" });
    return null;
  }
  return userId;
}

router.get("/members", async (req: Request, res: Response) => {
  try {
    const trainerId = await requireTrainerOrOwner(req, res);
    if (!trainerId) return;

    const profiles = await db
      .select({
        id: userProfiles.clerkId,
        name: userProfiles.name,
      })
      .from(userProfiles)
      .where(eq(userProfiles.role, "member"))
      .orderBy(userProfiles.name);

    const clerkClient = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    const { data: users } = await clerkClient.users.getUserList({ limit: 200 });
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
        profile.name.trim() ||
        clerkData?.fallbackName ||
        clerkData?.email ||
        profile.id;

      return {
        id: profile.id,
        name: resolvedName,
        email: clerkData?.email ?? "",
      };
    });

    res.json(members);
  } catch (err) {
    console.error("Error fetching workout members:", err);
    res.status(500).json({ error: "Failed to fetch members" });
  }
});

router.get("/templates", async (req: Request, res: Response) => {
  try {
    const trainerId = await requireTrainerOrOwner(req, res);
    if (!trainerId) return;
    const templates = await db
      .select()
      .from(workoutTemplates)
      .where(eq(workoutTemplates.trainerId, trainerId))
      .orderBy(workoutTemplates.createdAt);
    res.json(templates);
  } catch (err) {
    console.error("Error fetching templates:", err);
    res.status(500).json({ error: "Failed to fetch templates" });
  }
});

router.post("/templates", async (req: Request, res: Response) => {
  try {
    const trainerId = await requireTrainerOrOwner(req, res);
    if (!trainerId) return;
    const { name, exercises, trainerName } = req.body as {
      name?: string;
      exercises?: unknown[];
      trainerName?: string;
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
        exerciseId:
          typeof ex.exerciseId === "string"
            ? ex.exerciseId
            : String(ex.exerciseId ?? ""),
        name: typeof ex.name === "string" ? ex.name : String(ex.name ?? ""),
        sets:
          typeof ex.sets === "number"
            ? ex.sets
            : parseInt(String(ex.sets ?? 3), 10) || 3,
        reps:
          typeof ex.reps === "number"
            ? ex.reps
            : parseInt(String(ex.reps ?? 10), 10) || 10,
        notes: typeof ex.notes === "string" && ex.notes ? ex.notes : undefined,
      };
    });
    const [template] = await db
      .insert(workoutTemplates)
      .values({
        trainerId,
        trainerName:
          typeof trainerName === "string" && trainerName.trim()
            ? trainerName.trim()
            : "Trainer",
        name: name.trim(),
        exercises: parsed,
      })
      .returning();
    res.status(201).json(template);
  } catch (err) {
    console.error("Error creating template:", err);
    res.status(500).json({ error: "Failed to create template" });
  }
});

router.delete("/templates/:id", async (req: Request, res: Response) => {
  try {
    const trainerId = await requireTrainerOrOwner(req, res);
    if (!trainerId) return;
    const rawTemplateId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;
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
          eq(workoutTemplates.trainerId, trainerId),
        ),
      );
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting template:", err);
    res.status(500).json({ error: "Failed to delete template" });
  }
});

router.post("/assign", async (req: Request, res: Response) => {
  try {
    const trainerId = await requireTrainerOrOwner(req, res);
    if (!trainerId) return;
    const { templateId, memberId } = req.body as {
      templateId?: number;
      memberId?: string;
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
          eq(workoutTemplates.trainerId, trainerId),
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
        templateId,
        trainerId,
        memberName: memberProfile.name.trim() || memberProfile.clerkId,
        memberClerkId: memberProfile.clerkId,
      })
      .returning();
    res.status(201).json(assignment);
  } catch (err) {
    console.error("Error assigning workout:", err);
    res.status(500).json({ error: "Failed to assign workout" });
  }
});

router.post("/assigned/bind", async (req: Request, res: Response) => {
  try {
    const auth = getAuth(req);
    const callerUserId = auth.userId;
    if (!callerUserId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const [serverProfile] = await db
      .select({ name: userProfiles.name })
      .from(userProfiles)
      .where(eq(userProfiles.clerkId, callerUserId))
      .limit(1);
    if (!serverProfile || !serverProfile.name) {
      res
        .status(400)
        .json({ error: "Profile not found. Sync your profile first." });
      return;
    }
    const result = await db
      .update(workoutAssignments)
      .set({ memberClerkId: callerUserId })
      .where(
        and(
          eq(workoutAssignments.memberName, serverProfile.name),
          isNull(workoutAssignments.memberClerkId),
        ),
      )
      .returning();
    res.json({ bound: result.length });
  } catch (err) {
    console.error("Error binding assignments:", err);
    res.status(500).json({ error: "Failed to bind assignments" });
  }
});

router.get("/assigned", async (req: Request, res: Response) => {
  try {
    const auth = getAuth(req);
    const callerUserId = auth.userId;
    if (!callerUserId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const memberId = Array.isArray(req.query.memberId)
      ? (req.query.memberId[0] as string)
      : (req.query.memberId as string | undefined);
    if (!memberId) {
      res.status(400).json({ error: "memberId query param is required" });
      return;
    }
    if (memberId !== callerUserId) {
      res
        .status(403)
        .json({ error: "You can only fetch your own assigned workouts" });
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
      .innerJoin(
        workoutTemplates,
        eq(workoutAssignments.templateId, workoutTemplates.id),
      )
      .where(eq(workoutAssignments.memberClerkId, callerUserId));
    res.json(assignments);
  } catch (err) {
    console.error("Error fetching assigned workouts:", err);
    res.status(500).json({ error: "Failed to fetch assigned workouts" });
  }
});

router.patch("/assigned/:id/complete", async (req: Request, res: Response) => {
  try {
    const auth = getAuth(req);
    const callerUserId = auth.userId;
    if (!callerUserId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const rawAssignmentId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;
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
    console.error("Error completing assignment:", err);
    res.status(500).json({ error: "Failed to complete assignment" });
  }
});

export default router;
