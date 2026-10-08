import type { LLMProvider } from "../../providers/llm/types.js";
import type { RetrievedChunk, RetrieveOptions } from "../retrieval/types.js";

export interface Citation {
  documentId: string;
  filename: string;
  pageNumber: number | null;
  chunkIndex: number;
  chunkId: string;
  similarity: number;
  snippet: string;
}

export interface EvidenceSufficiencyResult {
  isSufficient: boolean;
  reason?: string | undefined;
  topSimilarity?: number | undefined;
  retrievedCount: number;
}

export interface GenerateAnswerOptions extends RetrieveOptions {
  minSufficiencyScore?: number | undefined;
  systemPrompt?: string | undefined;
  temperature?: number | undefined;
  maxTokens?: number | undefined;
  llmProvider?: LLMProvider | undefined;
}

export interface GenerateAnswerResult {
  answer: string;
  evidenceSufficient: boolean;
  refusalReason?: string | undefined;
  citations: Citation[];
  retrievedChunks: RetrievedChunk[];
  modelName: string;
  providerName: string;
}
