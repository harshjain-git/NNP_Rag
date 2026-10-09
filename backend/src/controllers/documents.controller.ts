import type { Request, Response } from "express";
import {
  processUploadedFiles,
  getDocuments,
  getDocumentById,
  deleteDocument,
} from "../services/document.service.js";

// Standard UUID format validator (8-4-4-4-12 hexadecimal string)
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const uploadDocumentController = async (
  req: Request,
  res: Response
): Promise<void> => {
  const files = req.files as Express.Multer.File[] | undefined;

  if (!files || files.length === 0) {
    res.status(400).json({
      error: "No file uploaded. Please provide at least one file with field name 'file'.",
    });
    return;
  }

  try {
    const { uploaded, skipped } = await processUploadedFiles(files);

    if (uploaded.length === 0) {
      res.status(409).json({
        message: "No documents uploaded. All files were duplicates.",
        uploaded: [],
        skipped,
      });
      return;
    }

    const message =
      skipped.length > 0
        ? `${uploaded.length} document(s) uploaded successfully, ${skipped.length} duplicate(s) skipped`
        : uploaded.length === 1
        ? "Document uploaded successfully"
        : `${uploaded.length} documents uploaded successfully`;

    res.status(201).json({
      message,
      uploaded,
      skipped,
    });
  } catch (error) {
    console.error("Error in uploadDocumentController:", error);
    res.status(500).json({ error: "Failed to upload document" });
  }
};

export const getDocumentsController = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const docs = await getDocuments();
    res.status(200).json({
      documents: docs,
    });
  } catch (error) {
    console.error("Error in getDocumentsController:", error);
    res.status(500).json({ error: "Failed to fetch documents" });
  }
};

export const getDocumentByIdController = async (
  req: Request,
  res: Response
): Promise<void> => {
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  if (!id || typeof id !== "string" || !UUID_REGEX.test(id.trim())) {
    res.status(400).json({
      error: "Invalid document ID format. Expected a valid UUID",
    });
    return;
  }

  try {
    const doc = await getDocumentById(id.trim());
    if (!doc) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    res.status(200).json({
      document: doc,
    });
  } catch (error) {
    console.error("Error in getDocumentByIdController:", error);
    res.status(500).json({ error: "Failed to fetch document" });
  }
};

export const deleteDocumentController = async (
  req: Request,
  res: Response
): Promise<void> => {
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  if (!id || typeof id !== "string" || !UUID_REGEX.test(id.trim())) {
    res.status(400).json({
      error: "Invalid document ID format. Expected a valid UUID",
    });
    return;
  }

  try {
    const deleted = await deleteDocument(id.trim());
    if (!deleted) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    res.status(200).json({
      message: "Document deleted successfully",
      documentId: deleted.id,
      filename: deleted.filename,
    });
  } catch (error) {
    console.error("Error in deleteDocumentController:", error);
    res.status(500).json({ error: "Failed to delete document" });
  }
};

