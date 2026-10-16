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
import { configService } from "../../services/config.service.js";
import type {
  RetrievedChunk,
  RetrieveOptions,
  PGVectorRetrieverOptions,
  RetrievalDebugChunk,
  RetrieveChunksResult,
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
 * Retrieves the most relevant document chunks for a query using cosine similarity in pgvector,
 * while capturing all candidate chunks, filter reasons, and LLM eligibility for debug inspection.
 */
export const retrieveChunksWithDebug = async (
  query: string,
  options?: RetrieveOptions
): Promise<RetrieveChunksResult> => {
  const trimmed = query.trim();
  const runtimeConfig = configService.getProjectConfig();
  const topK = options?.topK ?? runtimeConfig.retrieval.topK ?? DEFAULT_RETRIEVAL_TOP_K;
  if (!trimmed || topK <= 0) {
    return { chunks: [], debugChunks: [] };
  }

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

  const minSim = options?.minSimilarity ?? runtimeConfig.retrieval.minSimilarity ?? DEFAULT_MIN_SIMILARITY;

  const uniqueChunks: RetrievedChunk[] = [];
  const debugChunks: RetrievalDebugChunk[] = [];
  const seenContents = new Set<string>();

  for (const r of rows) {
    const rawSim = Number(r.similarity);
    const formattedSim = Number(rawSim.toFixed(4));
    const normalized = r.content.trim().toLowerCase();

    if (minSim !== undefined && rawSim < minSim) {
      debugChunks.push({
        id: r.id,
        chunkId: r.id,
        documentId: r.documentId,
        filename: r.filename,
        pageNumber: r.pageNumber,
        chunkIndex: r.chunkIndex,
        similarity: formattedSim,
        passedToLLM: false,
        filterReason: `Similarity score (${formattedSim.toFixed(4)}) is below the minimum similarity threshold (${minSim.toFixed(4)})`,
      });
      continue;
    }

    // Deduplicate identical or whitespace-normalized chunks across pages
    if (seenContents.has(normalized)) {
      debugChunks.push({
        id: r.id,
        chunkId: r.id,
        documentId: r.documentId,
        filename: r.filename,
        pageNumber: r.pageNumber,
        chunkIndex: r.chunkIndex,
        similarity: formattedSim,
        passedToLLM: false,
        filterReason: "Duplicate content detected across document pages",
      });
      continue;
    }
    seenContents.add(normalized);

    if (uniqueChunks.length >= topK) {
      debugChunks.push({
        id: r.id,
        chunkId: r.id,
        documentId: r.documentId,
        filename: r.filename,
        pageNumber: r.pageNumber,
        chunkIndex: r.chunkIndex,
        similarity: formattedSim,
        passedToLLM: false,
        filterReason: `Exceeded topK limit of ${topK}`,
      });
      continue;
    }

    const chunkItem: RetrievedChunk = {
      id: r.id,
      documentId: r.documentId,
      filename: r.filename,
      content: r.content,
      pageNumber: r.pageNumber,
      chunkIndex: r.chunkIndex,
      similarity: formattedSim,
      metadata: (r.metadata as Record<string, unknown>) ?? {},
    };

    uniqueChunks.push(chunkItem);
    debugChunks.push({
      id: r.id,
      chunkId: r.id,
      documentId: r.documentId,
      filename: r.filename,
      pageNumber: r.pageNumber,
      chunkIndex: r.chunkIndex,
      similarity: formattedSim,
      passedToLLM: true,
      filterReason: null,
    });
  }

  return { chunks: uniqueChunks, debugChunks };
};

/**
 * Retrieves the most relevant document chunks for a query using cosine similarity in pgvector.
 */
export const retrieveChunks = async (
  query: string,
  options?: RetrieveOptions
): Promise<RetrievedChunk[]> => {
  const result = await retrieveChunksWithDebug(query, options);
  return result.chunks;
};

export const chunkRetriever = {
  retrieveChunks,
  retrieveChunksWithDebug,
};

