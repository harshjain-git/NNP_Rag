import { Router } from "express";
import { chatController } from "../controllers/chat.controller.js";

const router = Router();

// POST /api/chat - RAG question-answering endpoint
router.post("/", chatController);

export default router;
