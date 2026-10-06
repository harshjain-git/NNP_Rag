import type { Request, Response } from "express";
import { processUploadedFiles } from "../services/document.service.js";

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
