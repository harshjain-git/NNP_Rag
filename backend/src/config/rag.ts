/**
 * RAG Chunking and Retrieval Tuning Defaults
 *
 * Configures document segmentation boundaries for structural Markdown chunking
 * and fallback recursive sentence splitting.
 */
export const DEFAULT_STRUCTURAL_TARGET = 1000;
export const DEFAULT_STRUCTURAL_MAX = 1200;
export const DEFAULT_FALLBACK_CHUNK_SIZE = 1000;
export const DEFAULT_FALLBACK_OVERLAP = 120;
export const DEFAULT_RETRIEVAL_TOP_K = 5;
export const DEFAULT_MIN_SUFFICIENCY_SCORE = 0.65;
export const DEFAULT_MIN_SIMILARITY = 0.5;
export const DEFAULT_MIN_CHUNK_CHARS = 300;
export const DEFAULT_INSUFFICIENT_EVIDENCE_MESSAGE =
  "I cannot answer this question based on the provided documents because there is insufficient relevant information available.";

export const MAX_ACTIVE_DOCUMENTS_PER_ADMIN = 10;
export const MAX_MESSAGES_PER_CONVERSATION = 50;
export const CONVERSATION_WARNING_THRESHOLDS = [8, 5] as const;
export const ROLLOVER_QA_PAIRS_COUNT = 8;
export const CONVERSATION_TITLE_MAX_LENGTH = 80;

export interface RagChunkingConfig {
  structuralTarget: number;
  structuralMax: number;
  fallbackChunkSize: number;
  fallbackOverlap: number;
}

export const defaultRagChunkingConfig: RagChunkingConfig = {
  structuralTarget: DEFAULT_STRUCTURAL_TARGET,
  structuralMax: DEFAULT_STRUCTURAL_MAX,
  fallbackChunkSize: DEFAULT_FALLBACK_CHUNK_SIZE,
  fallbackOverlap: DEFAULT_FALLBACK_OVERLAP,
};
