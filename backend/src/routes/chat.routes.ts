import { Router } from "express";
import { chatController } from "../controllers/chat.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";
import { ROLE_NAMES } from "../database/schema.js";

const router = Router();

// POST /api/chat - RAG question-answering endpoint (all authenticated users)
router.post(
  "/",
  authenticate,
  requireRole(ROLE_NAMES.USER, ROLE_NAMES.ADMIN, ROLE_NAMES.SUPER_ADMIN),
  chatController
);

export default router;
