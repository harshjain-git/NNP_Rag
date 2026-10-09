import {
  BaseRetriever,
  TextNode,
  type NodeWithScore,
  type QueryBundle,
} from "llamaindex";
import { and, asc, cosineDistance, eq, sql } from "drizzle-orm";
import { db } from "../../database/client.js";
import { documentChunks, documents } from "../../database/schema.js";
import { getEmbeddingProvider } from "../../providers/embeddings/index.js";
import {
  DEFAULT_MIN_SIMILARITY,
  DEFAULT_RETRIEVAL_TOP_K,
} from "../../config/rag.js";
import type {
  RetrievedChunk,
  RetrieveOptions,
  PGVectorRetrieverOptions,
} from "./types.js";

/**
 * LlamaIndex BaseRetriever implementation backed by PostgreSQL + pgvector cosine similarity.
 */
export class PGVectorRetriever extends BaseRetriever {
  constructor(private options: PGVectorRetrieverOptions = {}) {
    super();
  }

  async _retrieve(params: QueryBundle): Promise<NodeWithScore[]> {
    const query = typeof params === "string" ? params : String(params.query ?? "");
    const chunks = await retrieveChunks(query, this.options);

    return chunks.map((c) => ({
      node: new TextNode({
        id_: c.id,
        text: c.content,
        metadata: {
          documentId: c.documentId,
          filename: c.filename,
          pageNumber: c.pageNumber,
          chunkIndex: c.chunkIndex,
          ...(c.metadata ?? {}),
        },
      }),
      score: c.similarity,
    }));
  }
}

/**
 * Retrieves the most relevant document chunks for a query using cosine similarity in pgvector.
 */
export const retrieveChunks = async (
  query: string,
  options?: RetrieveOptions
): Promise<RetrievedChunk[]> => {
  const trimmed = query.trim();
  const topK = options?.topK ?? DEFAULT_RETRIEVAL_TOP_K;
  if (!trimmed || topK <= 0) return [];

  const provider = options?.embeddingProvider ?? getEmbeddingProvider();
  const queryEmbedding = await provider.generateEmbedding(trimmed);

  const similarityExpr = sql<number>`1 - (${cosineDistance(documentChunks.embedding, queryEmbedding)})`;

  // Fetch a larger candidate pool to ensure topK unique chunks after deduplication
  const fetchLimit = Math.max(topK * 3, 15);

  const rows = await db
    .select({
      id: documentChunks.id,
      documentId: documentChunks.documentId,
      filename: documents.filename,
      content: documentChunks.content,
      pageNumber: documentChunks.pageNumber,
      chunkIndex: documentChunks.chunkIndex,
      metadata: documentChunks.metadata,
      similarity: similarityExpr,
    })
    .from(documentChunks)
    .innerJoin(documents, eq(documentChunks.documentId, documents.id))
    .where(
      and(
        eq(documents.status, "ready"),
        options?.documentId ? eq(documentChunks.documentId, options.documentId) : undefined
      )
    )
    .orderBy(asc(cosineDistance(documentChunks.embedding, queryEmbedding)))
    .limit(fetchLimit);

  const minSim = options?.minSimilarity ?? DEFAULT_MIN_SIMILARITY;
  const uniqueChunks: RetrievedChunk[] = [];
  const seenContents = new Set<string>();

  for (const r of rows) {
    if (minSim !== undefined && Number(r.similarity) < minSim) {
      continue;
    }

    // Deduplicate identical or whitespace-normalized chunks across pages
    const normalized = r.content.trim().toLowerCase();
    if (seenContents.has(normalized)) {
      continue;
    }
    seenContents.add(normalized);

    uniqueChunks.push({
      id: r.id,
      documentId: r.documentId,
      filename: r.filename,
      content: r.content,
      pageNumber: r.pageNumber,
      chunkIndex: r.chunkIndex,
      similarity: Number(Number(r.similarity).toFixed(4)),
      metadata: (r.metadata as Record<string, unknown>) ?? {},
    });

    if (uniqueChunks.length >= topK) {
      break;
    }
  }

  return uniqueChunks;
};
