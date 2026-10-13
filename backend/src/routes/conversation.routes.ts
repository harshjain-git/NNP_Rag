import { Router } from "express";
import {
  listConversationsController,
  getConversationByIdController,
  deleteConversationController,
} from "../controllers/conversation.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";
import { ROLE_NAMES } from "../database/schema.js";

const router = Router();

// All conversation routes require authentication and are accessible to any valid user role
router.use(
  authenticate,
  requireRole(ROLE_NAMES.USER, ROLE_NAMES.ADMIN, ROLE_NAMES.SUPER_ADMIN)
);

// GET /api/conversations - list authenticated user's conversations ordered by updatedAt desc
router.get("/", listConversationsController);

// GET /api/conversations/:id - get conversation with messages in chronological order
router.get("/:id", getConversationByIdController);

// DELETE /api/conversations/:id - delete conversation and cascade messages
router.delete("/:id", deleteConversationController);

export default router;
