import { Router } from "express";
import {
  registerController,
  loginController,
  getProfileController,
  updateProfileController,
  changePasswordController,
} from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

// Public authentication endpoints
router.post("/register", registerController);
router.post("/login", loginController);

// Authenticated user profile and account endpoints
router.get("/me", authenticate, getProfileController);
router.patch("/profile", authenticate, updateProfileController);
router.patch("/password", authenticate, changePasswordController);

export default router;
