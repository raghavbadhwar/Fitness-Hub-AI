import { Router, type IRouter } from "express";
import healthRouter from "./health";
import aiRouter from "./ai";
import classesRouter from "./classes";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/ai", aiRouter);
router.use(classesRouter);
router.use("/admin", adminRouter);

export default router;
