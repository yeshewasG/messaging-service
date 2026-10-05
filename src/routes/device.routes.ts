import { Router } from "express";
import { registerDevice } from "../controllers/device.controller";

const router = Router();

router.post("/register", registerDevice);

export default router;
