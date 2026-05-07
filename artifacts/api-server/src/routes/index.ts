import { Router, type IRouter } from "express";
import healthRouter from "./health";
import aiRouter from "./ai";
import classesRouter from "./classes";
import adminRouter from "./admin";
import workoutsRouter from "./workouts";
import profilesRouter from "./profiles";
import monthlyReviewsRouter from "./monthly-reviews";
import nutritionRouter from "./nutrition";
import progressRouter from "./progress";
import notificationsRouter from "./notifications";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/ai", aiRouter);
router.use(classesRouter);
router.use("/admin", adminRouter);
router.use("/workouts", workoutsRouter);
router.use("/nutrition", nutritionRouter);
router.use("/progress", progressRouter);
router.use("/notifications", notificationsRouter);
router.use("/profiles", profilesRouter);
router.use("/monthly-reviews", monthlyReviewsRouter);

export default router;
