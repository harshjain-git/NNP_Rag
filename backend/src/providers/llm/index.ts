import type { LLMProvider } from "./types.js";
import { groqLLMProvider } from "./groq.js";
import { geminiLLMProvider } from "./gemini.js";
import { ollamaLLMProvider } from "./ollama.js";
import { LLM_PROVIDER } from "../../config/env.js";

export * from "./types.js";
export * from "./groq.js";
export * from "./gemini.js";
export * from "./ollama.js";

export type LLMProviderType = "groq" | "gemini" | "ollama";

export const getLLMProvider = (
  providerType: string = LLM_PROVIDER
): LLMProvider => {
  switch (providerType.toLowerCase()) {
    case "groq":
      return groqLLMProvider;
    case "gemini":
      return geminiLLMProvider;
    case "ollama":
      return ollamaLLMProvider;
    default:
      return groqLLMProvider;
  }
};
