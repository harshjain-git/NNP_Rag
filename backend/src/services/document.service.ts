import fs from "node:fs/promises";
import path from "node:path";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "../database/client.js";
import { documents, ROLE_NAMES, type Document } from "../database/schema.js";
import { enqueueDocuments, cancelIngestion } from "../rag/ingestion/index.js";
import { computeFileHash, deleteFile, deleteFiles } from "../utils/file.js";
import { MAX_ACTIVE_DOCUMENTS_PER_ADMIN } from "../config/rag.js";

export { MAX_ACTIVE_DOCUMENTS_PER_ADMIN };

export interface CreateDocumentInput {
  filename: string;
  fileType: string;
  filePath: string;
  contentHash: string;
  uploadedBy?: string | null;
}

export type SkippedDocument = { filename: string; reason: string };

export type ProcessUploadResult =
  | { uploaded: Document[]; skipped: SkippedDocument[] }
  | { error: "limitExceeded"; message: string; activeCount: number; attemptedCount: number };

export type DeleteDocumentResult =
  | { success: true; document: Document }
  | { error: "notFound" | "forbidden" }
  | { error: "cleanupFailed"; details: string };

const locks = new Map<string, Promise<void>>();

export const withAdminUploadLock = async <T>(
  adminId: string,
  fn: () => Promise<T>
): Promise<T> => {
  const prev = locks.get(adminId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((r) => { release = r; });
  locks.set(adminId, prev.then(() => current, () => current));

  try {
    await prev;
    return await fn();
  } finally {
    release();
    if (locks.get(adminId) === current) locks.delete(adminId);
  }
};

export const getActiveDocumentCount = async (adminId: string): Promise<number> => {
  const [res] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(documents)
    .where(and(eq(documents.uploadedBy, adminId), ne(documents.status, "failed")));
  return res?.count ?? 0;
};

export const findExistingHashes = async (hashes: string[]): Promise<string[]> => {
  if (hashes.length === 0) return [];
  const rows = await db
    .select({ hash: documents.contentHash })
    .from(documents)
    .where(inArray(documents.contentHash, hashes));
  return rows.map((r) => r.hash);
};

export const uploadDocuments = async (
  inputs: CreateDocumentInput[],
  uploadedBy?: string | null
): Promise<Document[]> => {
  if (inputs.length === 0) return [];
  return db
    .insert(documents)
    .values(
      inputs.map((input) => ({
        ...input,
        uploadedBy: input.uploadedBy ?? uploadedBy ?? null,
        status: "uploaded",
      }))
    )
    .returning();
};

export const processUploadedFiles = async (
  files: Express.Multer.File[],
  uploadedBy?: string | null
): Promise<ProcessUploadResult> => {
  if (!uploadedBy) {
    await deleteFiles(files);
    throw new Error("Uploader identity is required to enforce document limits");
  }

  return withAdminUploadLock(uploadedBy, async () => {
    const activeCount = await getActiveDocumentCount(uploadedBy);
    if (activeCount >= MAX_ACTIVE_DOCUMENTS_PER_ADMIN) {
      await deleteFiles(files);
      return {
        error: "limitExceeded",
        message: `Maximum active document limit of ${MAX_ACTIVE_DOCUMENTS_PER_ADMIN} reached. You currently have ${activeCount} active document(s).`,
        activeCount,
        attemptedCount: files.length,
      };
    }

    const hashed = await Promise.all(
      files.map(async (file) => ({ file, hash: await computeFileHash(file.path) }))
    );
    const existingHashes = new Set(await findExistingHashes(hashed.map((h) => h.hash)));
    const seen = new Set<string>();
    const validFiles: typeof hashed = [];
    const skipped: SkippedDocument[] = [];

    for (const item of hashed) {
      const reason = seen.has(item.hash)
        ? "Duplicate content in batch"
        : existingHashes.has(item.hash)
        ? "Duplicate content already exists"
        : null;
      if (reason) {
        await deleteFile(item.file.path);
        skipped.push({ filename: item.file.originalname, reason });
      } else {
        seen.add(item.hash);
        validFiles.push(item);
      }
    }

    if (validFiles.length === 0) return { uploaded: [], skipped };

    if (activeCount + validFiles.length > MAX_ACTIVE_DOCUMENTS_PER_ADMIN) {
      await deleteFiles(validFiles.map((v) => v.file.path));
      return {
        error: "limitExceeded",
        message: `Upload exceeds maximum active document limit of ${MAX_ACTIVE_DOCUMENTS_PER_ADMIN} per admin. Current active documents: ${activeCount}, attempting to add: ${validFiles.length}.`,
        activeCount,
        attemptedCount: validFiles.length,
      };
    }

    try {
      const inputs: CreateDocumentInput[] = validFiles.map(({ file, hash }) => ({
        filename: file.originalname,
        fileType: path.extname(file.originalname).slice(1).toLowerCase(),
        filePath: path.relative(process.cwd(), file.path).replace(/\\/g, "/"),
        contentHash: hash,
        uploadedBy,
      }));

      const uploaded = await uploadDocuments(inputs, uploadedBy);
      if (uploaded.length > 0) enqueueDocuments(uploaded.map((d) => d.id));
      return { uploaded, skipped };
    } catch (error) {
      await deleteFiles(validFiles.map((v) => v.file.path));
      throw error;
    }
  });
};

export const getDocuments = async (): Promise<Document[]> =>
  db.select().from(documents).orderBy(desc(documents.createdAt));

export const getDocumentById = async (id: string): Promise<Document | null> => {
  const [found] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  return found ?? null;
};

export const deleteDocument = async (
  id: string,
  user?: { id: string; role: string }
): Promise<DeleteDocumentResult> => {
  const document = await getDocumentById(id);
  if (!document) return { error: "notFound" };

  if (user && user.role !== ROLE_NAMES.SUPER_ADMIN && document.uploadedBy !== user.id) {
    return { error: "forbidden" };
  }

  cancelIngestion(document.id);

  if (document.filePath) {
    const fullPath = path.resolve(process.cwd(), document.filePath);
    try {
      await fs.unlink(fullPath);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error(`Failed to delete local file ${fullPath}:`, err);
        return { error: "cleanupFailed", details: `Failed to remove local file: ${(err as Error).message}` };
      }
    }
  }

  const [deleted] = await db.delete(documents).where(eq(documents.id, id)).returning();
  return deleted ? { success: true, document: deleted } : { error: "notFound" };
};
