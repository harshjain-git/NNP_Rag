import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "../../database/client.js";
import { documents, type Document } from "../../database/schema.js";
import {
  localEmbeddingProvider,
  type EmbeddingProvider,
} from "../../providers/embeddings/index.js";
import { parseDocument } from "./parser.js";
import { chunkDocument } from "./chunker.js";
import {
  persistDocumentChunks,
  updateDocumentStatus,
} from "./persistence.js";
import { publishIngestionEvent } from "../../realtime/index.js";

export interface IngestDocumentOptions {
  embeddingProvider?: EmbeddingProvider;
}

export interface IngestDocumentResult {
  documentId: string;
  filename: string;
  totalPages: number;
  totalChunks: number;
}

/**
 * End-to-end document ingestion pipeline orchestrator:
 * 1. Query document if documentId string is provided
 * 2. Update status to 'processing' & emit 'document.processing'
 * 3. Parse pages & emit 'document.parsing'
 * 4. Chunk parsed content & emit 'document.chunking'
 * 5. Generate vector embeddings & emit 'document.embedding'
 * 6. Atomically persist chunks to PostgreSQL + pgvector & emit 'document.ready'
 * 7. Emit 'document.failed' on error
 */
export const ingestDocument = async (
  documentOrId: string | Document,
  options?: IngestDocumentOptions
): Promise<IngestDocumentResult> => {
  const provider = options?.embeddingProvider ?? localEmbeddingProvider;
  let document: Document;

  if (typeof documentOrId === "string") {
    const found = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentOrId))
      .limit(1);

    if (!found || found.length === 0 || !found[0]) {
      throw new Error(`Document not found: ${documentOrId}`);
    }
    document = found[0];
  } else {
    document = documentOrId;
  }

  // Mark document status as processing
  await updateDocumentStatus(document.id, "processing");
  publishIngestionEvent("document.processing", {
    documentId: document.id,
    filename: document.filename,
  });

  try {
    // Resolve absolute path for cross-platform file access
    const absoluteFilePath = path.isAbsolute(document.filePath)
      ? document.filePath
      : path.resolve(process.cwd(), document.filePath);

    // 1. Parse document pages
    publishIngestionEvent("document.parsing", {
      documentId: document.id,
      filename: document.filename,
    });
    const parseResult = await parseDocument(absoluteFilePath);

    // 2. Chunk parsed content into structured/sentence nodes
    publishIngestionEvent("document.chunking", {
      documentId: document.id,
      filename: document.filename,
      totalPages: parseResult.pages.length,
    });
    const chunks = chunkDocument(parseResult, {
      documentId: document.id,
      filename: document.filename,
    });

    if (chunks.length === 0) {
      await updateDocumentStatus(document.id, "ready");
      publishIngestionEvent("document.ready", {
        documentId: document.id,
        filename: document.filename,
        totalPages: parseResult.pages.length,
        totalChunks: 0,
      });

      return {
        documentId: document.id,
        filename: document.filename,
        totalPages: parseResult.pages.length,
        totalChunks: 0,
      };
    }

    // 3. Generate vector embeddings
    publishIngestionEvent("document.embedding", {
      documentId: document.id,
      filename: document.filename,
      totalChunks: chunks.length,
    });
    const texts = chunks.map((c) => c.content);
    const embeddings = await provider.generateEmbeddings(texts);

    // 4. Atomically persist chunks and vector embeddings into pgvector
    await persistDocumentChunks({
      documentId: document.id,
      chunks,
      embeddings,
      expectedDimensions: provider.dimensions,
    });

    publishIngestionEvent("document.ready", {
      documentId: document.id,
      filename: document.filename,
      totalPages: parseResult.pages.length,
      totalChunks: chunks.length,
    });

    return {
      documentId: document.id,
      filename: document.filename,
      totalPages: parseResult.pages.length,
      totalChunks: chunks.length,
    };
  } catch (error) {
    await updateDocumentStatus(document.id, "failed");
    publishIngestionEvent("document.failed", {
      documentId: document.id,
      filename: document.filename,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

