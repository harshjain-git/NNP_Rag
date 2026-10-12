import { Router } from "express";
import {
  listUsersController,
  updateUserRoleController,
  createUserByAdminController,
} from "../controllers/admin.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";
import { ROLE_NAMES } from "../database/schema.js";

const router = Router();

// Protect all admin user management routes: strictly SUPER_ADMIN only
router.use(authenticate, requireRole(ROLE_NAMES.SUPER_ADMIN));

// GET /api/admin/users - List registered users with safe details and assigned roles
router.get("/users", listUsersController);

// PATCH /api/admin/users/:id/role - Promote or demote user with safeguards
router.patch("/users/:id/role", updateUserRoleController);

// POST /api/admin/users - Directly provision user with specified role
router.post("/users", createUserByAdminController);

export default router;
