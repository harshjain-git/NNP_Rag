export type DocumentStatus = "uploaded" | "processing" | "ready" | "failed";
export type IngestionStage = "processing" | "parsing" | "chunking" | "embedding";

export interface DocumentItem {
  id: string;
  filename: string;
  fileType: string;
  filePath: string;
  contentHash: string;
  status: DocumentStatus;
  stage?: IngestionStage;
  totalPages?: number;
  totalChunks?: number;
  errorMessage?: string;
  uploadedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentWithChunkCount extends DocumentItem {
  chunkCount: number;
}

export interface SkippedDocument {
  filename: string;
  reason: string;
}

export interface UploadDocumentsResponse {
  message?: string;
  uploaded: DocumentItem[];
  skipped: SkippedDocument[];
}

export interface DocumentListResponse {
  documents: DocumentItem[];
}

export interface DocumentDetailResponse {
  document: DocumentWithChunkCount;
}

export interface DeleteDocumentResponse {
  message: string;
  documentId: string;
  filename: string;
}
