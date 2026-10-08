import type { EmbeddingProvider } from "../../providers/embeddings/types.js";

export interface RetrievedChunk {
  id: string;
  documentId: string;
  filename: string;
  content: string;
  pageNumber: number | null;
  chunkIndex: number;
  similarity: number;
  metadata?: Record<string, unknown>;
}

export interface RetrieveOptions {
  topK?: number | undefined;
  documentId?: string | undefined;
  minSimilarity?: number | undefined;
  embeddingProvider?: EmbeddingProvider | undefined;
}

export interface PGVectorRetrieverOptions extends RetrieveOptions {}
