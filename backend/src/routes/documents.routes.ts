import { Router } from "express";
import {
  uploadDocumentController,
  getDocumentsController,
  getDocumentByIdController,
  deleteDocumentController,
} from "../controllers/documents.controller.js";
import { handleFileUpload } from "../middleware/upload.middleware.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";
import { ROLE_NAMES } from "../database/schema.js";

const router = Router();

// Upload document endpoint - ADMIN and SUPER_ADMIN only
router.post(
  "/upload",
  authenticate,
  requireRole(ROLE_NAMES.ADMIN, ROLE_NAMES.SUPER_ADMIN),
  handleFileUpload,
  uploadDocumentController
);

// Check & list documents endpoints - accessible to all authenticated roles (USER, ADMIN, SUPER_ADMIN)
router.get(
  "/",
  authenticate,
  requireRole(ROLE_NAMES.USER, ROLE_NAMES.ADMIN, ROLE_NAMES.SUPER_ADMIN),
  getDocumentsController
);
router.get(
  "/:id",
  authenticate,
  requireRole(ROLE_NAMES.USER, ROLE_NAMES.ADMIN, ROLE_NAMES.SUPER_ADMIN),
  getDocumentByIdController
);

// Delete document endpoint - ADMIN and SUPER_ADMIN only
router.delete(
  "/:id",
  authenticate,
  requireRole(ROLE_NAMES.ADMIN, ROLE_NAMES.SUPER_ADMIN),
  deleteDocumentController
);

export default router;
