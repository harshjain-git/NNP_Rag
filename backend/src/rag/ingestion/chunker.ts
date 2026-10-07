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
}

const DEFAULT_STRUCTURAL_TARGET = 1000;
const DEFAULT_STRUCTURAL_MAX = 1200;
const DEFAULT_FALLBACK_CHUNK_SIZE = 1000;
const DEFAULT_FALLBACK_OVERLAP = 120;

/**
 * Document chunking layer using LlamaIndex.TS.
 *
 * 1. Primary: Document-aware / structural chunking via MarkdownNodeParser.
 *    Keeps reasonably sized sections (headings, tables, lists) intact.
 * 2. Fallback: Recursive sentence-aware splitting via SentenceSplitter
 *    only when a structural section exceeds the maximum token limit.
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

  const chunks: IngestionChunk[] = [];

  // 2. Evaluate each structural node against token limits
  for (const node of structuralNodes) {
    const content = node.getContent(MetadataMode.NONE).trim();
    if (!content) continue;

    // Evaluate token count using LlamaIndex tokenizer
    const tokenCount = fallbackSplitter.tokenSize(content);

    if (tokenCount <= structuralMax) {
      // Reasonably sized structural section: keep intact
      chunks.push({
        content,
        pageNumber:
          typeof node.metadata.pageNumber === "number"
            ? node.metadata.pageNumber
            : undefined,
        chunkIndex: chunks.length,
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

        chunks.push({
          content: subContent,
          pageNumber:
            typeof subNode.metadata.pageNumber === "number"
              ? subNode.metadata.pageNumber
              : undefined,
          chunkIndex: chunks.length,
          metadata: {
            ...subNode.metadata,
            tokenCount: fallbackSplitter.tokenSize(subContent),
            splitMethod: "fallback_sentence_splitter",
          },
        });
      }
    }
  }

  return chunks;
};
