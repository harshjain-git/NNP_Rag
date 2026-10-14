export type PromptType = "system" | "rag" | "citation";
export type PromptStatus = "active" | "draft";

export interface Prompt {
  id: string;
  name: string;
  content: string;
  type: PromptType;
  status: PromptStatus;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePromptPayload {
  name: string;
  content: string;
  type?: PromptType;
  status?: PromptStatus;
}

export interface UpdatePromptPayload {
  name?: string;
  content?: string;
  type?: PromptType;
  status?: PromptStatus;
}

export interface PromptListResponse {
  prompts: Prompt[];
}

export interface PromptResponse {
  message?: string;
  prompt: Prompt;
}
