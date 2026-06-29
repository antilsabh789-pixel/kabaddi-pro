import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import playersRouter from "./players";
import tournamentsRouter from "./tournaments";
import teamsRouter from "./teams";
import matchesRouter from "./matches";
import paymentsRouter from "./payments";
import premiumRouter from "./premium";
import socialRouter from "./social";
import statsRouter from "./stats";
import coachRouter from "./coach";
import miscRouter from "./misc";
import giveawayRouter from "./giveaway";
import streakRouter from "./streak";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(playersRouter);
router.use(tournamentsRouter);
router.use(teamsRouter);
router.use(matchesRouter);
router.use(paymentsRouter);
router.use(premiumRouter);
router.use(socialRouter);
router.use(statsRouter);
router.use(coachRouter);
router.use(miscRouter);
router.use(giveawayRouter);
router.use(streakRouter);
router.use(adminRouter);

export default router;
