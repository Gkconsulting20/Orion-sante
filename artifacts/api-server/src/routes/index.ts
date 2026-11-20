import { Router, type IRouter } from "express";
import healthRouter from "./health";
import clinicRouter from "./clinic";
import platformRouter from "./platform";

const router: IRouter = Router();

router.use(healthRouter);
router.use(clinicRouter);
router.use(platformRouter);

export default router;
