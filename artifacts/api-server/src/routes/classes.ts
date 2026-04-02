import { Router, type Request, type Response } from "express";
import { gte } from "drizzle-orm";
import { db, gymClassesTable } from "@workspace/db";

const router = Router();

router.get("/classes", async (_req: Request, res: Response): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];
  const classes = await db
    .select()
    .from(gymClassesTable)
    .where(gte(gymClassesTable.date, today))
    .orderBy(gymClassesTable.date, gymClassesTable.startTime);

  res.json(
    classes.map((cls) => ({
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
    })),
  );
});

export default router;
