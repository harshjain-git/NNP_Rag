import { Document, MarkdownNodeParser, SentenceSplitter, MetadataMode } from "llamaindex";
import type { ParsedPage, ParseResult } from "./parser.js";

export interface IngestionChunk {
  content: string;
  pageNumber?: number | undefined;
  chunkIndex: number;
  metadata: Record<string, unknown>;
}

export interface ChunkOptions {
  documentId?: string;
  filename?: string;
  structuralTarget?: number;
  structuralMax?: number;
  fallbackChunkSize?: number;
  fallbackOverlap?: number;
  minChunkChars?: number;
}
import {
  DEFAULT_STRUCTURAL_TARGET,
  DEFAULT_STRUCTURAL_MAX,
  DEFAULT_FALLBACK_CHUNK_SIZE,
  DEFAULT_FALLBACK_OVERLAP,
  DEFAULT_MIN_CHUNK_CHARS,
} from "../../config/rag.js";

/**
 * Document chunking layer using LlamaIndex.TS.
 *
 * 1. Primary: Document-aware / structural chunking via MarkdownNodeParser.
 *    Keeps reasonably sized sections (headings, tables, lists) intact.
 * 2. Fallback: Recursive sentence-aware splitting via SentenceSplitter
 *    only when a structural section exceeds the maximum token limit.
 * 3. Micro-chunk merging: Prevents isolated page headers from becoming
 *    standalone vector chunks by prepending them to the next section.
 */
export const chunkDocument = (
  input: ParseResult | ParsedPage[],
  options?: ChunkOptions
): IngestionChunk[] => {
  const pages: ParsedPage[] = Array.isArray(input)
    ? input
    : input.pages && input.pages.length > 0
    ? input.pages
    : input.text
    ? [{ pageNumber: 1, text: input.text }]
    : [];

  if (pages.length === 0) {
    return [];
  }

  const structuralMax = options?.structuralMax ?? DEFAULT_STRUCTURAL_MAX;
  const fallbackChunkSize = options?.fallbackChunkSize ?? DEFAULT_FALLBACK_CHUNK_SIZE;
  const fallbackOverlap = options?.fallbackOverlap ?? DEFAULT_FALLBACK_OVERLAP;
  const minChunkChars = options?.minChunkChars ?? DEFAULT_MIN_CHUNK_CHARS;

  const markdownParser = new MarkdownNodeParser();
  const fallbackSplitter = new SentenceSplitter({
    chunkSize: fallbackChunkSize,
    chunkOverlap: fallbackOverlap,
  });

  // Convert each parsed page to a LlamaIndex Document, preserving pageNumber and metadata
  const documents = pages
    .filter((page) => page.text && page.text.trim().length > 0)
    .map(
      (page) =>
        new Document({
          text: page.text,
          metadata: {
            pageNumber: page.pageNumber,
            ...(options?.documentId ? { documentId: options.documentId } : {}),
            ...(options?.filename ? { filename: options.filename } : {}),
          },
        })
    );

  if (documents.length === 0) {
    return [];
  }

  // 1. Primary pass: structural splitting based on markdown headers
  const structuralNodes = markdownParser.getNodesFromDocuments(documents);

  const rawChunks: IngestionChunk[] = [];

  // 2. Evaluate each structural node against token limits
  for (const node of structuralNodes) {
    const content = node.getContent(MetadataMode.NONE).trim();
    if (!content) continue;

    // Evaluate token count using LlamaIndex tokenizer
    const tokenCount = fallbackSplitter.tokenSize(content);

    if (tokenCount <= structuralMax) {
      // Reasonably sized structural section: keep intact
      rawChunks.push({
        content,
        pageNumber:
          typeof node.metadata.pageNumber === "number"
            ? node.metadata.pageNumber
            : undefined,
        chunkIndex: rawChunks.length,
        metadata: {
          ...node.metadata,
          tokenCount,
          splitMethod: "structural",
        },
      });
    } else {
      // 3. Fallback pass: oversized section split recursively via SentenceSplitter
      const subNodes = fallbackSplitter.getNodesFromDocuments([node]);
      for (const subNode of subNodes) {
        const subContent = subNode.getContent(MetadataMode.NONE).trim();
        if (!subContent) continue;

        rawChunks.push({
          content: subContent,
          pageNumber:
            typeof subNode.metadata.pageNumber === "number"
              ? subNode.metadata.pageNumber
              : undefined,
          chunkIndex: rawChunks.length,
          metadata: {
            ...subNode.metadata,
            tokenCount: fallbackSplitter.tokenSize(subContent),
            splitMethod: "fallback_sentence_splitter",
          },
        });
      }
    }
  }

  // 4. Merge micro-chunks (such as isolated page headers) into adjacent content
  if (rawChunks.length <= 1) {
    return rawChunks;
  }

  const mergedChunks: IngestionChunk[] = [];
  let pendingPrefix = "";

  for (let i = 0; i < rawChunks.length; i++) {
    const current = rawChunks[i]!;
    if (pendingPrefix) {
      current.content = `${pendingPrefix}\n\n${current.content}`;
      pendingPrefix = "";
    }

    if (current.content.length < minChunkChars && i < rawChunks.length - 1) {
      pendingPrefix = current.content;
      continue;
    }

    current.chunkIndex = mergedChunks.length;
    mergedChunks.push(current);
  }

  if (pendingPrefix) {
    if (mergedChunks.length > 0) {
      const last = mergedChunks[mergedChunks.length - 1]!;
      last.content = `${last.content}\n\n${pendingPrefix}`;
    } else {
      mergedChunks.push({
        content: pendingPrefix,
        chunkIndex: 0,
        metadata: { splitMethod: "single" },
      });
    }
  }

  return mergedChunks;
};
