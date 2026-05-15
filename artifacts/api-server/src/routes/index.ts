import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import securityGroupsRouter from "./security-groups";
import categoriesRouter from "./categories";
import prioritiesRouter from "./priorities";
import tasksRouter from "./tasks";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(securityGroupsRouter);
router.use(categoriesRouter);
router.use(prioritiesRouter);
router.use(tasksRouter);
router.use(dashboardRouter);

export default router;
