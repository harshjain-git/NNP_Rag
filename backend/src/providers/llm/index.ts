import type { LLMProvider } from "./types.js";
import { GroqLLMProvider, groqLLMProvider } from "./groq.js";
import { GeminiLLMProvider, geminiLLMProvider } from "./gemini.js";
import { OllamaLLMProvider, ollamaLLMProvider } from "./ollama.js";
import { LLM_PROVIDER } from "../../config/env.js";
import { configService } from "../../services/config.service.js";

export * from "./types.js";
export * from "./groq.js";
export * from "./gemini.js";
export * from "./ollama.js";

export type LLMProviderType = "groq" | "gemini" | "ollama";

export const getLLMProvider = (
  providerType?: string,
  modelNameOverride?: string
): LLMProvider => {
  const cfg = configService.getProjectConfig().models;
  const chosen = (providerType || cfg.llmProvider || LLM_PROVIDER).toLowerCase();
  const activeModel = modelNameOverride || cfg.llmModel;

  switch (chosen) {
    case "groq":
      return activeModel && activeModel !== groqLLMProvider.modelName
        ? new GroqLLMProvider(activeModel)
        : groqLLMProvider;
    case "gemini":
      return activeModel && activeModel !== geminiLLMProvider.modelName
        ? new GeminiLLMProvider(activeModel)
        : geminiLLMProvider;
    case "ollama":
      return activeModel && activeModel !== ollamaLLMProvider.modelName
        ? new OllamaLLMProvider(activeModel)
        : ollamaLLMProvider;
    default:
      return groqLLMProvider;
  }
};

