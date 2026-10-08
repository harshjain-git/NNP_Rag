/**
 * Ingestion Realtime Event Types & Contract
 *
 * Defines the standard lifecycle events published by the document ingestion pipeline.
 */
export type IngestionEventType =
  | "document.processing"
  | "document.parsing"
  | "document.chunking"
  | "document.embedding"
  | "document.ready"
  | "document.failed";

export interface IngestionEventPayload {
  documentId: string;
  filename?: string;
  totalChunks?: number;
  totalPages?: number;
  error?: string;
  timestamp?: string;
}

export interface IngestionEvent {
  type: IngestionEventType;
  payload: IngestionEventPayload;
}
