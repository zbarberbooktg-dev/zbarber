import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import barbersRouter from "./barbers";
import servicesRouter from "./services";
import reservationsRouter from "./reservations";
import reviewsRouter from "./reviews";
import subscriptionsRouter from "./subscriptions";
import financingRouter from "./financing";
import conferencesRouter from "./conferences";
import notificationsRouter from "./notifications";
import adminRouter from "./admin";
import storageRouter from "./storage";
import homeGalleryRouter from "./home-gallery";
import locationsRouter from "./locations";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(barbersRouter);
router.use(servicesRouter);
router.use(reservationsRouter);
router.use(reviewsRouter);
router.use(subscriptionsRouter);
router.use(financingRouter);
router.use(conferencesRouter);
router.use(notificationsRouter);
router.use(storageRouter);
router.use(homeGalleryRouter);
router.use(locationsRouter);
router.use(adminRouter);

export default router;
