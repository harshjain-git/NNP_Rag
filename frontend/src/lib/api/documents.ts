import { request } from "./client";
import type {
  DocumentListResponse,
  DocumentDetailResponse,
  UploadDocumentsResponse,
  DeleteDocumentResponse,
} from "@/types";

export async function getDocuments(token?: string | null): Promise<DocumentListResponse> {
  return request<DocumentListResponse>("/api/documents", { method: "GET", token });
}

export async function getDocumentById(
  id: string,
  token?: string | null
): Promise<DocumentDetailResponse> {
  return request<DocumentDetailResponse>(`/api/documents/${encodeURIComponent(id)}`, {
    method: "GET",
    token,
  });
}

export async function uploadDocuments(
  files: File[] | FileList,
  token?: string | null
): Promise<UploadDocumentsResponse> {
  const formData = new FormData();
  Array.from(files).forEach((file) => formData.append("file", file));

  return request<UploadDocumentsResponse>("/api/documents/upload", {
    method: "POST",
    body: formData,
    token,
  });
}

export async function deleteDocument(
  id: string,
  token?: string | null
): Promise<DeleteDocumentResponse> {
  return request<DeleteDocumentResponse>(`/api/documents/${encodeURIComponent(id)}`, {
    method: "DELETE",
    token,
  });
}
