import { request } from "./client";
import type {
  PromptType,
  PromptStatus,
  PromptListResponse,
  PromptResponse,
  CreatePromptPayload,
  UpdatePromptPayload,
} from "@/types";

export async function getPrompts(
  filters?: { type?: PromptType; status?: PromptStatus },
  token?: string | null
): Promise<PromptListResponse> {
  const params = new URLSearchParams();
  if (filters?.type) params.set("type", filters.type);
  if (filters?.status) params.set("status", filters.status);
  const q = params.toString() ? `?${params.toString()}` : "";

  return request<PromptListResponse>(`/api/prompts${q}`, { method: "GET", token });
}

export async function getActivePrompt(
  type: PromptType,
  token?: string | null
): Promise<PromptResponse> {
  return request<PromptResponse>(`/api/prompts/active/${encodeURIComponent(type)}`, {
    method: "GET",
    token,
  });
}

export async function getPromptById(
  id: string,
  token?: string | null
): Promise<PromptResponse> {
  return request<PromptResponse>(`/api/prompts/${encodeURIComponent(id)}`, {
    method: "GET",
    token,
  });
}

export async function createPrompt(
  payload: CreatePromptPayload,
  token?: string | null
): Promise<PromptResponse> {
  return request<PromptResponse>("/api/prompts", {
    method: "POST",
    body: JSON.stringify(payload),
    token,
  });
}

export async function updatePrompt(
  id: string,
  payload: UpdatePromptPayload,
  token?: string | null
): Promise<PromptResponse> {
  return request<PromptResponse>(`/api/prompts/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
    token,
  });
}

export async function deletePrompt(
  id: string,
  token?: string | null
): Promise<{ message: string; id: string }> {
  return request<{ message: string; id: string }>(
    `/api/prompts/${encodeURIComponent(id)}`,
    { method: "DELETE", token }
  );
}
