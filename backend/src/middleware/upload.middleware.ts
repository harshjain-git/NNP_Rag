import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import type { Request, Response, NextFunction } from "express";

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
const MAX_FILE_COUNT = 10;

// Ensure upload directory exists
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_EXTENSIONS = new Set([".pdf", ".txt", ".docx"]);
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/octet-stream",
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
): void => {
  const ext = path.extname(file.originalname).toLowerCase();
  const isValid =
    ALLOWED_EXTENSIONS.has(ext) && ALLOWED_MIME_TYPES.has(file.mimetype);

  if (!isValid) {
    cb(new Error("Invalid file type. Only PDF, TXT, and DOCX files are supported."));
    return;
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

export const handleFileUpload = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  upload.any()(req, res, (err: unknown) => {
    if (!err) {
      const files = req.files as Express.Multer.File[] | undefined;
      if (files && files.length > MAX_FILE_COUNT) {
        for (const file of files) {
          if (fs.existsSync(file.path)) {
            try {
              fs.unlinkSync(file.path);
            } catch {}
          }
        }
        res.status(400).json({
          error: `Maximum ${MAX_FILE_COUNT} files allowed per upload`,
        });
        return;
      }
      return next();
    }

    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({ error: "File size exceeds 25MB limit" });
        return;
      }
      res.status(400).json({ error: err.message });
      return;
    }

    const errorMessage =
      err instanceof Error ? err.message : "File upload failed";
    res.status(400).json({ error: errorMessage });
  });
};
