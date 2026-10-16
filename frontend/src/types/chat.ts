export interface Citation {
  documentId: string;
  filename: string;
  pageNumber: number | null;
  chunkIndex: number;
  chunkId: string;
  similarity: number;
  snippet: string;
}

export interface ChatRequest {
  query: string;
  conversationId?: string;
  documentId?: string;
  systemPrompt?: string;
}

export interface RetrievalDebugChunk {
  id: string;
  chunkId: string;
  documentId: string;
  filename: string;
  pageNumber: number | null;
  chunkIndex: number;
  similarity: number;
  passedToLLM: boolean;
  filterReason?: string | null;
}

export interface ContextChunk {
  id: string;
  chunkId: string;
  documentId: string;
  filename: string;
  pageNumber: number | null;
  chunkIndex: number;
  similarity: number;
  text: string;
  content: string;
}

export interface RetrievalDebugInfo {
  retrievedChunks: RetrievalDebugChunk[];
  contextChunks: ContextChunk[];
  filterReason?: string | null;
}

export interface ChatResponse {
  conversationId?: string;
  answer: string;
  evidenceSufficient: boolean;
  refusalReason?: string;
  citations: Citation[];
  modelName: string;
  providerName: string;
  remainingMessages: number;
  warning: string | null;
  isNewConversation: boolean;
  retrievalDebug?: RetrievalDebugInfo;
}
