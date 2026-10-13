import { Router } from "express";
import {
  createPromptController,
  listPromptsController,
  getActivePromptController,
  getPromptByIdController,
  updatePromptController,
  deletePromptController,
} from "../controllers/prompts.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";
import { ROLE_NAMES } from "../database/schema.js";

const router = Router();

// Protect all prompt management routes: strictly ADMIN and SUPER_ADMIN only
router.use(
  authenticate,
  requireRole(ROLE_NAMES.ADMIN, ROLE_NAMES.SUPER_ADMIN)
);

// POST /api/prompts - create new prompt
router.post("/", createPromptController);

// GET /api/prompts - list prompts with optional type/status filters
router.get("/", listPromptsController);

// GET /api/prompts/active/:type - get active prompt for type (registered before /:id)
router.get("/active/:type", getActivePromptController);

// GET /api/prompts/:id - get prompt by id
router.get("/:id", getPromptByIdController);

// PATCH /api/prompts/:id - update prompt fields
router.patch("/:id", updatePromptController);

// DELETE /api/prompts/:id - delete prompt by id
router.delete("/:id", deletePromptController);

export default router;
