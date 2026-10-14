import { request } from "./client";
import type {
  ConversationListResponse,
  ConversationDetailResponse,
  DeleteConversationResponse,
} from "@/types";

export async function getConversations(
  token?: string | null
): Promise<ConversationListResponse> {
  return request<ConversationListResponse>("/api/conversations", {
    method: "GET",
    token,
  });
}

export async function getConversationById(
  id: string,
  token?: string | null
): Promise<ConversationDetailResponse> {
  return request<ConversationDetailResponse>(
    `/api/conversations/${encodeURIComponent(id)}`,
    { method: "GET", token }
  );
}

export async function deleteConversation(
  id: string,
  token?: string | null
): Promise<DeleteConversationResponse> {
  return request<DeleteConversationResponse>(
    `/api/conversations/${encodeURIComponent(id)}`,
    { method: "DELETE", token }
  );
}
