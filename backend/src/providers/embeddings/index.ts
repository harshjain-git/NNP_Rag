import type { EmbeddingProvider } from "./types.js";
import { localEmbeddingProvider } from "./local.js";

export * from "./types.js";
export * from "./local.js";

export type EmbeddingProviderType = "local";

export const getEmbeddingProvider = (
  providerType: EmbeddingProviderType = "local"
): EmbeddingProvider => {
  switch (providerType) {
    case "local":
      return localEmbeddingProvider;
    default:
      return localEmbeddingProvider;
  }
};
