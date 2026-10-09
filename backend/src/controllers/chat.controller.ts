import type { Request, Response } from "express";
import { generateAnswer } from "../rag/generation/generator.js";

// Standard UUID format validator (8-4-4-4-12 hexadecimal string)
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Controller handling RAG question-answering requests.
 *
 * Route: POST /api/chat
 * Payload: { query: string, documentId?: string }
 */
export const chatController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { query, documentId } = (req.body ?? {}) as {
      query?: unknown;
      documentId?: unknown;
    };

    // 1. Validate query: required non-empty string
    if (query === undefined || query === null) {
      res.status(400).json({ error: "Query is required" });
      return;
    }

    if (typeof query !== "string") {
      res.status(400).json({ error: "Query must be a string" });
      return;
    }

    const trimmedQuery = query.trim();
    if (trimmedQuery.length === 0) {
      res.status(400).json({ error: "Query cannot be empty" });
      return;
    }

    // 2. Validate optional documentId: must be a valid UUID if provided
    let targetDocumentId: string | undefined;
    if (documentId !== undefined && documentId !== null) {
      if (typeof documentId !== "string" || !UUID_REGEX.test(documentId.trim())) {
        res.status(400).json({
          error: "Invalid documentId format. Expected a valid UUID",
        });
        return;
      }
      targetDocumentId = documentId.trim();
    }

    // 3. Execute generation pipeline with retrieved evidence & sufficiency checks
    const result = await generateAnswer(trimmedQuery, {
      documentId: targetDocumentId,
    });

    res.status(200).json({
      answer: result.answer,
      evidenceSufficient: result.evidenceSufficient,
      refusalReason: result.refusalReason,
      citations: result.citations,
      modelName: result.modelName,
      providerName: result.providerName,
    });
  } catch (error) {
    console.error("Error in chatController:", error);
    res.status(500).json({
      error: "Failed to generate answer",
    });
  }
};
