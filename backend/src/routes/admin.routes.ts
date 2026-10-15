import { Router } from "express";
import {
  listUsersController,
  updateUserRoleController,
  createUserByAdminController,
  deleteUserController,
  getProjectConfigController,
  updateProjectConfigController,
} from "../controllers/admin.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";
import { ROLE_NAMES } from "../database/schema.js";

const router = Router();

// Protect all admin routes: strictly SUPER_ADMIN only
router.use(authenticate, requireRole(ROLE_NAMES.SUPER_ADMIN));

// User management endpoints
router.get("/users", listUsersController);
router.patch("/users/:id/role", updateUserRoleController);
router.post("/users", createUserByAdminController);
router.delete("/users/:id", deleteUserController);

// Project configuration endpoints
router.get("/config", getProjectConfigController);
router.patch("/config", updateProjectConfigController);

export default router;

