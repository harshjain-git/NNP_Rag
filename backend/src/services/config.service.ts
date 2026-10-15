import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  LLM_PROVIDER,
  LLM_MODEL,
  EMBEDDING_MODEL,
  INGESTION_CONCURRENCY,
  NODE_ENV,
} from "../config/env.js";
import {
  DEFAULT_RETRIEVAL_TOP_K,
  DEFAULT_MIN_SIMILARITY,
  DEFAULT_MIN_SUFFICIENCY_SCORE,
  DEFAULT_STRUCTURAL_TARGET,
  DEFAULT_STRUCTURAL_MAX,
  DEFAULT_FALLBACK_CHUNK_SIZE,
  DEFAULT_FALLBACK_OVERLAP,
  DEFAULT_MIN_CHUNK_CHARS,
} from "../config/rag.js";

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

const SETTINGS_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../runtime-settings.json");
const SUPPORTED_LLMS: LLMProviderName[] = ["groq", "gemini", "ollama"];
const FIXED_EMBED_MODEL = "Xenova/jina-embeddings-v2-small-en";

const currentConfig: ProjectConfig = {
  models: {
    llmProvider: (SUPPORTED_LLMS.includes(LLM_PROVIDER as LLMProviderName) ? LLM_PROVIDER : "ollama") as LLMProviderName,
    llmModel: LLM_MODEL,
    embeddingProvider: "local",
    embeddingModel: EMBEDDING_MODEL || FIXED_EMBED_MODEL,
    supportedLLMProviders: SUPPORTED_LLMS,
    supportedEmbeddingProviders: ["local"],
    embeddingDimension: 512,
  },
  retrieval: {
    topK: DEFAULT_RETRIEVAL_TOP_K,
    minSimilarity: DEFAULT_MIN_SIMILARITY,
    minSufficiencyScore: DEFAULT_MIN_SUFFICIENCY_SCORE,
  },
  chunking: {
    structuralTarget: DEFAULT_STRUCTURAL_TARGET,
    structuralMax: DEFAULT_STRUCTURAL_MAX,
    fallbackChunkSize: DEFAULT_FALLBACK_CHUNK_SIZE,
    fallbackOverlap: DEFAULT_FALLBACK_OVERLAP,
    minChunkChars: DEFAULT_MIN_CHUNK_CHARS,
  },
  generation: { temperature: 0.1, maxTokens: 1024 },
  system: { ingestionConcurrency: INGESTION_CONCURRENCY, nodeEnv: NODE_ENV, databaseStatus: "connected" },
};

// Load saved settings if available
try {
  if (fs.existsSync(SETTINGS_FILE)) {
    const saved = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
    if (saved.models) Object.assign(currentConfig.models, saved.models);
    if (saved.retrieval) Object.assign(currentConfig.retrieval, saved.retrieval);
    if (saved.chunking) Object.assign(currentConfig.chunking, saved.chunking);
    if (saved.generation) Object.assign(currentConfig.generation, saved.generation);
    if (saved.system?.ingestionConcurrency) currentConfig.system.ingestionConcurrency = saved.system.ingestionConcurrency;
  }
} catch {
  // Graceful fallback to default config
}

const inRange = (val: unknown, min: number, max: number, isInt = false): boolean =>
  typeof val === "number" && (!isInt || Number.isInteger(val)) && val >= min && val <= max;

export const getProjectConfig = (): ProjectConfig => JSON.parse(JSON.stringify(currentConfig));

export const updateProjectConfig = (
  payload: UpdateProjectConfigPayload
): { config?: ProjectConfig; error?: string } => {
  const { models: m, retrieval: r, chunking: c, generation: g, system: s } = payload;

  if (m) {
    if (m.llmProvider && !SUPPORTED_LLMS.includes(m.llmProvider as LLMProviderName)) {
      return { error: `Invalid LLM provider "${m.llmProvider}". Supported: ${SUPPORTED_LLMS.join(", ")}` };
    }
    if (m.embeddingProvider && m.embeddingProvider !== "local") {
      return { error: "Only 'local' embedding provider is supported. Vector schema requires 512 dimensions." };
    }
    if (m.embeddingModel && m.embeddingModel !== FIXED_EMBED_MODEL) {
      return { error: `Embedding model cannot be changed without re-indexing. Active schema requires 512-dim (${FIXED_EMBED_MODEL}).` };
    }
    if (m.llmModel !== undefined && !m.llmModel.trim()) {
      return { error: "LLM model name cannot be empty." };
    }
  }

  if (r) {
    if (r.topK !== undefined && !inRange(r.topK, 1, 50, true)) return { error: "topK must be an integer between 1 and 50." };
    if (r.minSimilarity !== undefined && !inRange(r.minSimilarity, 0, 1)) return { error: "minSimilarity must be a number between 0.0 and 1.0." };
    if (r.minSufficiencyScore !== undefined && !inRange(r.minSufficiencyScore, 0, 1)) return { error: "minSufficiencyScore must be a number between 0.0 and 1.0." };
  }

  if (c) {
    if (c.structuralTarget !== undefined && !inRange(c.structuralTarget, 100, 5000, true)) return { error: "structuralTarget must be an integer between 100 and 5000." };
    if (c.structuralMax !== undefined && (!inRange(c.structuralMax, 100, 10000, true) || c.structuralMax < (c.structuralTarget ?? currentConfig.chunking.structuralTarget))) {
      return { error: "structuralMax must be greater than or equal to structuralTarget." };
    }
    if (c.fallbackChunkSize !== undefined && !inRange(c.fallbackChunkSize, 100, 5000, true)) return { error: "fallbackChunkSize must be an integer between 100 and 5000." };
    if (c.fallbackOverlap !== undefined && (!inRange(c.fallbackOverlap, 0, 2500, true) || c.fallbackOverlap >= (c.fallbackChunkSize ?? currentConfig.chunking.fallbackChunkSize))) {
      return { error: "fallbackOverlap must be less than fallbackChunkSize." };
    }
    if (c.minChunkChars !== undefined && !inRange(c.minChunkChars, 50, 1000, true)) return { error: "minChunkChars must be an integer between 50 and 1000." };
  }

  if (g) {
    if (g.temperature !== undefined && !inRange(g.temperature, 0, 1)) return { error: "temperature must be a number between 0.0 and 1.0." };
    if (g.maxTokens !== undefined && !inRange(g.maxTokens, 64, 4096, true)) return { error: "maxTokens must be an integer between 64 and 4096." };
  }

  if (s?.ingestionConcurrency !== undefined && !inRange(s.ingestionConcurrency, 1, 10, true)) {
    return { error: "ingestionConcurrency must be an integer between 1 and 10." };
  }

  // Apply updates
  if (m?.llmProvider) currentConfig.models.llmProvider = m.llmProvider as LLMProviderName;
  if (m?.llmModel) currentConfig.models.llmModel = m.llmModel.trim();
  if (r) Object.assign(currentConfig.retrieval, r);
  if (c) Object.assign(currentConfig.chunking, c);
  if (g) Object.assign(currentConfig.generation, g);
  if (s?.ingestionConcurrency !== undefined) currentConfig.system.ingestionConcurrency = s.ingestionConcurrency;

  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(currentConfig, null, 2), "utf-8");
  } catch {
    // Non-fatal if persistence fails
  }

  listeners.forEach((fn) => {
    try {
      fn(getProjectConfig());
    } catch (e) {
      console.error("Config change listener failed:", e);
    }
  });

  return { config: getProjectConfig() };
};

export type ConfigChangeListener = (config: ProjectConfig) => void;
const listeners: ConfigChangeListener[] = [];
export const onConfigChange = (fn: ConfigChangeListener): void => {
  listeners.push(fn);
};

export const configService = { getProjectConfig, updateProjectConfig, onConfigChange };
