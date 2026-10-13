import fs from "node:fs/promises";
import crypto from "node:crypto";

/**
 * Computes SHA-256 hash across raw file bytes.
 */
export const computeFileHash = async (filePath: string): Promise<string> => {
  const buffer = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
};

/**
 * Safely unlinks a file from the filesystem.
 * Ignores ENOENT (already removed) while logging unexpected errors.
 */
export const deleteFile = async (filePath: string): Promise<void> => {
  try {
    await fs.unlink(filePath);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error(`Failed to delete file ${filePath}:`, err);
    }
  }
};

/**
 * Helper to delete multiple files or Multer file objects concurrently.
 */
export const deleteFiles = async (
  files: (string | { path: string })[]
): Promise<void> => {
  await Promise.all(
    files.map((item) => {
      const p = typeof item === "string" ? item : item.path;
      return deleteFile(p);
    })
  );
};
