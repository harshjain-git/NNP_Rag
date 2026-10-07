import { eq } from "drizzle-orm";
import { db } from "../../database/client.js";
import {
  documentChunks,
  documents,
  type Document,
  type NewDocumentChunk,
} from "../../database/schema.js";
import { localEmbeddingProvider } from "../../providers/embeddings/index.js";
import type { IngestionChunk } from "./chunker.js";
import { chunkDocument } from "./chunker.js";
import { parseDocument } from "./parser.js";

export interface PersistChunksInput {
  documentId: string;
  chunks: IngestionChunk[];
  embeddings: number[][];
}

export interface IngestDocumentResult {
  documentId: string;
  filename: string;
  totalPages: number;
  totalChunks: number;
}

/**
 * Persist document chunks and their embeddings into PostgreSQL + pgvector.
 *
 * Enforces validation, preserves sequential chunkIndex and metadata,
 * and clears any pre-existing chunks for the document to guarantee idempotency.
 */
export const persistDocumentChunks = async ({
  documentId,
  chunks,
  embeddings,
}: PersistChunksInput): Promise<number> => {
  if (chunks.length !== embeddings.length) {
    throw new Error(
      `Chunk count (${chunks.length}) does not match embedding count (${embeddings.length}) for document ${documentId}`
    );
  }

  if (chunks.length === 0) {
    return 0;
  }

  // Validate embedding dimensions (must be 512)
  for (let i = 0; i < embeddings.length; i++) {
    const emb = embeddings[i];
    if (!emb || emb.length !== 512) {
      throw new Error(
        `Invalid embedding dimension at index ${i}: expected 512, got ${emb?.length ?? 0}`
      );
    }
  }

  // Clear pre-existing chunks for this document to prevent duplicates on re-ingestion
  await db
    .delete(documentChunks)
    .where(eq(documentChunks.documentId, documentId));

  // Prepare schema rows
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

  // Bulk insert into PostgreSQL pgvector table
  await db.insert(documentChunks).values(rowsToInsert);

  // Update document status
  await db
    .update(documents)
    .set({ status: "ready", updatedAt: new Date() })
    .where(eq(documents.id, documentId));

  return rowsToInsert.length;
};

/**
 * Full single-document ingestion pipeline:
 * Document -> Parse ALL pages -> Clean -> chunkDocument() -> generateEmbeddings() -> persistDocumentChunks()
 */
export const ingestDocument = async (
  document: Document
): Promise<IngestDocumentResult> => {
  // Update status to processing
  await db
    .update(documents)
    .set({ status: "processing", updatedAt: new Date() })
    .where(eq(documents.id, document.id));

  try {
    // 1. Parse ALL pages (LlamaParse automatically applies cleanText)
    const parseResult = await parseDocument(document.filePath);

    // 2. Chunk ALL parsed content
    const chunks = chunkDocument(parseResult, {
      documentId: document.id,
      filename: document.filename,
    });

    if (chunks.length === 0) {
      await db
        .update(documents)
        .set({ status: "ready", updatedAt: new Date() })
        .where(eq(documents.id, document.id));

      return {
        documentId: document.id,
        filename: document.filename,
        totalPages: parseResult.pages.length,
        totalChunks: 0,
      };
    }

    // 3. Generate 512-dimensional embeddings for every chunk
    const texts = chunks.map((c) => c.content);
    const embeddings = await localEmbeddingProvider.generateEmbeddings(texts);

    // 4. Persist chunks + embeddings into database
    await persistDocumentChunks({
      documentId: document.id,
      chunks,
      embeddings,
    });

    return {
      documentId: document.id,
      filename: document.filename,
      totalPages: parseResult.pages.length,
      totalChunks: chunks.length,
    };
  } catch (error) {
    await db
      .update(documents)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(documents.id, document.id));
    throw error;
  }
};
