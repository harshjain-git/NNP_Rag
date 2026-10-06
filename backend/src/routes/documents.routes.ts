import { Router } from "express";
import { uploadDocumentController } from "../controllers/documents.controller.js";
import { handleFileUpload } from "../middleware/upload.middleware.js";

const router = Router();

router.post("/", handleFileUpload, uploadDocumentController);

export default router;
