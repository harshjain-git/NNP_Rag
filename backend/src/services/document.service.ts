import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { inArray } from "drizzle-orm";
import { db } from "../database/client.js";
import { documents, type Document } from "../database/schema.js";

export interface CreateDocumentInput {
  filename: string;
  fileType: string;
  filePath: string;
  contentHash: string;
}

export interface SkippedDocument {
  filename: string;
  reason: string;
}

export interface ProcessUploadResult {
  uploaded: Document[];
  skipped: SkippedDocument[];
}

const computeFileHash = (filePath: string): string => {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
};

const deleteFile = (filePath: string): void => {
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.error(`Failed to delete file ${filePath}:`, err);
    }
  }
};

export const findExistingHashes = async (
  hashes: string[]
): Promise<string[]> => {
  if (hashes.length === 0) return [];
  const existing = await db
    .select({ contentHash: documents.contentHash })
    .from(documents)
    .where(inArray(documents.contentHash, hashes));
  return existing.map((doc) => doc.contentHash);
};

export const uploadDocuments = async (
  inputs: CreateDocumentInput[]
): Promise<Document[]> => {
  if (inputs.length === 0) return [];

  return await db
    .insert(documents)
    .values(
      inputs.map((input) => ({
        filename: input.filename,
        fileType: input.fileType,
        filePath: input.filePath,
        contentHash: input.contentHash,
        status: "uploaded",
      }))
    )
    .returning();
};

export const processUploadedFiles = async (
  files: Express.Multer.File[]
): Promise<ProcessUploadResult> => {
  const skipped: SkippedDocument[] = [];
  const uniqueBatchFiles: { file: Express.Multer.File; hash: string }[] = [];
  const seenHashesInBatch = new Set<string>();

  // 1. Filter out duplicates within the current batch
  for (const file of files) {
    const hash = computeFileHash(file.path);
    if (seenHashesInBatch.has(hash)) {
      deleteFile(file.path);
      skipped.push({
        filename: file.originalname,
        reason: "Duplicate content in batch",
      });
      continue;
    }
    seenHashesInBatch.add(hash);
    uniqueBatchFiles.push({ file, hash });
  }

  // 2. Filter out duplicates that already exist in the database
  const candidateHashes = uniqueBatchFiles.map((item) => item.hash);
  const existingHashes = new Set(await findExistingHashes(candidateHashes));

  const validFilesToInsert: { file: Express.Multer.File; hash: string }[] = [];

  for (const item of uniqueBatchFiles) {
    if (existingHashes.has(item.hash)) {
      deleteFile(item.file.path);
      skipped.push({
        filename: item.file.originalname,
        reason: "Duplicate content already exists",
      });
    } else {
      validFilesToInsert.push(item);
    }
  }

  // 3. Persist valid new files
  try {
    const documentInputs = validFilesToInsert.map(({ file, hash }) => ({
      filename: file.originalname,
      fileType: path.extname(file.originalname).slice(1).toLowerCase(),
      filePath: path.relative(process.cwd(), file.path).replace(/\\/g, "/"),
      contentHash: hash,
    }));

    const uploaded = await uploadDocuments(documentInputs);

    return {
      uploaded,
      skipped,
    };
  } catch (error) {
    for (const item of validFilesToInsert) {
      deleteFile(item.file.path);
    }
    throw error;
  }
};
