import type { LLMProvider } from "../../providers/llm/types.js";
import type {
  RetrievedChunk,
  RetrieveOptions,
  RetrievalDebugInfo,
} from "../retrieval/types.js";

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
  conversationHistory?: Array<{ role: string; content: string }> | undefined;
  retriever?: ((query: string, options?: RetrieveOptions) => Promise<RetrievedChunk[]>) | undefined;
}

export interface GenerateAnswerStreamOptions extends GenerateAnswerOptions {
  onToken: (token: string) => void | Promise<void>;
  signal?: AbortSignal | undefined;
}


export interface GenerateAnswerResult {
  answer: string;
  evidenceSufficient: boolean;
  refusalReason?: string | undefined;
  citations: Citation[];
  retrievedChunks: RetrievedChunk[];
  modelName: string;
  providerName: string;
  retrievalDebug: RetrievalDebugInfo;
}
