import { eq } from "drizzle-orm";
import { db } from "../../database/client.js";
import {
  documentChunks,
  documents,
  type NewDocumentChunk,
} from "../../database/schema.js";
import { LOCAL_EMBEDDING_DIMENSIONS } from "../../providers/embeddings/index.js";
import type { IngestionChunk } from "./chunker.js";

export type DocumentProcessingStatus =
  | "uploaded"
  | "processing"
  | "ready"
  | "failed";

export interface PersistChunksInput {
  documentId: string;
  chunks: IngestionChunk[];
  embeddings: number[][];
  expectedDimensions?: number;
}

/**
 * Updates a document's lifecycle processing status in the database.
 */
export const updateDocumentStatus = async (
  documentId: string,
  status: DocumentProcessingStatus
): Promise<void> => {
  await db
    .update(documents)
    .set({ status, updatedAt: new Date() })
    .where(eq(documents.id, documentId));
};

/**
 * Persists document chunks and vector embeddings into PostgreSQL + pgvector atomically.
 *
 * Enforces count/dimension validation, preserves chunkIndex and metadata,
 * and clears pre-existing chunks within an ACID database transaction.
 */
export const persistDocumentChunks = async ({
  documentId,
  chunks,
  embeddings,
  expectedDimensions = LOCAL_EMBEDDING_DIMENSIONS,
}: PersistChunksInput): Promise<number> => {
  if (chunks.length !== embeddings.length) {
    throw new Error(
      `Chunk count (${chunks.length}) does not match embedding count (${embeddings.length}) for document ${documentId}`
    );
  }

  // Validate embedding dimensions against target vector dimensions
  for (let i = 0; i < embeddings.length; i++) {
    const emb = embeddings[i];
    if (!emb || emb.length !== expectedDimensions) {
      throw new Error(
        `Invalid embedding dimension at index ${i}: expected ${expectedDimensions}, got ${emb?.length ?? 0}`
      );
    }
  }

  // Execute chunk cleanup, bulk insertion, and document status update atomically
  return await db.transaction(async (tx) => {
    // Clear pre-existing chunks to guarantee idempotency on re-ingestion
    await tx
      .delete(documentChunks)
      .where(eq(documentChunks.documentId, documentId));

    if (chunks.length > 0) {
      const rowsToInsert: NewDocumentChunk[] = chunks.map((chunk, index) => {
        const embedding = embeddings[index];
        if (!embedding) {
          throw new Error(`Missing embedding at index ${index}`);
        }

        return {
          documentId,
          content: chunk.content,
          pageNumber: chunk.pageNumber ?? null,
          chunkIndex: chunk.chunkIndex,
          embedding,
          metadata: chunk.metadata ?? {},
        };
      });

      await tx.insert(documentChunks).values(rowsToInsert);
    }

    await tx
      .update(documents)
      .set({ status: "ready", updatedAt: new Date() })
      .where(eq(documents.id, documentId));

    return chunks.length;
  });
};
