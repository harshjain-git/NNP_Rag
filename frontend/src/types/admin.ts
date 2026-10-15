import type { SafeUser, RoleName } from "./auth";

export interface AdminUserListResponse {
  users: SafeUser[];
}

export interface CreateAdminUserPayload {
  name: string;
  email: string;
  password: string;
  role?: RoleName;
}

export interface UpdateUserRolePayload {
  role: RoleName;
}

export interface AdminUserResponse {
  message: string;
  user: SafeUser;
}

export type LLMProviderName = "groq" | "gemini" | "ollama";
export type EmbeddingProviderName = "local";

export interface ProjectConfig {
  models: {
    llmProvider: LLMProviderName;
    llmModel: string;
    embeddingProvider: EmbeddingProviderName;
    embeddingModel: string;
    supportedLLMProviders: LLMProviderName[];
    supportedEmbeddingProviders: EmbeddingProviderName[];
    embeddingDimension: number;
  };
  retrieval: {
    topK: number;
    minSimilarity: number;
    minSufficiencyScore: number;
  };
  chunking: {
    structuralTarget: number;
    structuralMax: number;
    fallbackChunkSize: number;
    fallbackOverlap: number;
    minChunkChars: number;
  };
  generation: {
    temperature: number;
    maxTokens: number;
  };
  system: {
    ingestionConcurrency: number;
    nodeEnv: string;
    databaseStatus: string;
  };
}

export type UpdateProjectConfigPayload = Partial<{
  models: Partial<ProjectConfig["models"]>;
  retrieval: Partial<ProjectConfig["retrieval"]>;
  chunking: Partial<ProjectConfig["chunking"]>;
  generation: Partial<ProjectConfig["generation"]>;
  system: Partial<ProjectConfig["system"]>;
}>;

export interface ProjectConfigResponse {
  config: ProjectConfig;
  message?: string;
}

