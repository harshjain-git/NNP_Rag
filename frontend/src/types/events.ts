import type { Citation } from "./chat";

export type IngestionEventType =
  | "connection.connected"
  | "document.processing"
  | "document.parsing"
  | "document.chunking"
  | "document.embedding"
  | "document.ready"
  | "document.failed";

export interface IngestionEventPayload {
  documentId?: string;
  filename?: string;
  totalChunks?: number;
  totalPages?: number;
  error?: string;
  message?: string;
  timestamp?: string;
}

export interface IngestionEvent {
  type: IngestionEventType;
  payload: IngestionEventPayload;
}

export type ChatClientEventType = "auth" | "chat.send" | "chat.cancel";

export interface ChatAuthPayload {
  token: string;
}

export interface ChatSendPayload {
  query: string;
  conversationId?: string;
  documentId?: string;
  systemPrompt?: string;
  requestId?: string;
  token?: string;
}

export interface ChatCancelPayload {
  requestId: string;
}

export type ChatServerEventType =
  | "connection.connected"
  | "auth.success"
  | "auth.error"
  | "chat.start"
  | "chat.token"
  | "chat.complete"
  | "chat.error";

export interface ConnectionConnectedPayload {
  message: string;
  timestamp: string;
}

export interface ChatStartPayload {
  requestId: string;
  conversationId: string;
}

export interface ChatTokenPayload {
  requestId: string;
  token: string;
}

export interface ChatCompletePayload {
  requestId: string;
  conversationId: string;
  answer: string;
  citations: Citation[];
  evidenceSufficient: boolean;
  refusalReason?: string | null;
  modelName: string;
  providerName: string;
  remainingMessages: number;
  warning: string | null;
  isNewConversation: boolean;
}

export interface ChatErrorPayload {
  requestId?: string;
  error: string;
  statusCode?: number;
}

export type RealtimeEventType =
  | IngestionEventType
  | ChatClientEventType
  | ChatServerEventType;

export type RealtimeEvent =
  | IngestionEvent
  | { type: "connection.connected"; payload: ConnectionConnectedPayload }
  | { type: "chat.start"; payload: ChatStartPayload }
  | { type: "chat.token"; payload: ChatTokenPayload }
  | { type: "chat.complete"; payload: ChatCompletePayload }
  | { type: "chat.error"; payload: ChatErrorPayload };

