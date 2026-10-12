import { Router } from "express";
import {
  registerController,
  loginController,
} from "../controllers/auth.controller.js";

const router = Router();

// Public authentication endpoints
router.post("/register", registerController);
router.post("/login", loginController);

export default router;
