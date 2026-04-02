import { Router, type IRouter } from "express";
import healthRouter from "./health";
import aiRouter from "./ai";
import classesRouter from "./classes";
import adminRouter from "./admin";
import workoutsRouter from "./workouts";
import profilesRouter from "./profiles";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/ai", aiRouter);
router.use(classesRouter);
router.use("/admin", adminRouter);
router.use("/workouts", workoutsRouter);
router.use("/profiles", profilesRouter);

export default router;
