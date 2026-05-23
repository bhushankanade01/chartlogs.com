import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import accountsRouter from "./accounts";
import tradesRouter from "./trades";
import journalRouter from "./journal";
import dashboardRouter from "./dashboard";
import analyticsRouter from "./analytics";
import marketRouter from "./market";
import toolsRouter from "./tools";
import adminRouter from "./admin";
import storageRouter from "./storage";
import checklistsRouter from "./checklists";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(accountsRouter);
router.use(tradesRouter);
router.use(journalRouter);
router.use(dashboardRouter);
router.use(analyticsRouter);
router.use(marketRouter);
router.use(toolsRouter);
router.use(adminRouter);
router.use(storageRouter);
router.use(checklistsRouter);

export default router;
