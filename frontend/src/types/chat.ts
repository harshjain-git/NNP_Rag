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
}
