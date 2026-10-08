import type { EmbeddingProvider } from "./types.js";
import { localEmbeddingProvider } from "./local.js";
import { EMBEDDING_PROVIDER } from "../../config/env.js";

export * from "./types.js";
export * from "./local.js";

export type EmbeddingProviderType = "local";

export const getEmbeddingProvider = (
  providerType: EmbeddingProviderType = (EMBEDDING_PROVIDER as EmbeddingProviderType) || "local"
): EmbeddingProvider => {
  switch (providerType) {
    case "local":
      return localEmbeddingProvider;
    default:
      return localEmbeddingProvider;
  }
};
