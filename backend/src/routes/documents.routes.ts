import { Router } from "express";
import {
  uploadDocumentController,
  getDocumentsController,
  getDocumentByIdController,
  deleteDocumentController,
} from "../controllers/documents.controller.js";
import { handleFileUpload } from "../middleware/upload.middleware.js";

const router = Router();

// Upload document endpoint
router.post("/upload", handleFileUpload, uploadDocumentController);

// Check & list documents endpoints
router.get("/", getDocumentsController);
router.get("/:id", getDocumentByIdController);

// Delete document endpoint
router.delete("/:id", deleteDocumentController);

export default router;
