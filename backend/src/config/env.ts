import "dotenv/config";

// ============================================================================
// 1. Core Server & Database Configuration
// ============================================================================
const PORT = Number(process.env.PORT) || 3000;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined in environment variables");
}

// ============================================================================
// 2. Document Parsing Configuration (LlamaParse)
// ============================================================================
// Used during document ingestion to parse uploaded PDFs, Word docs, and complex
// layouts into structured Markdown text.
const LLAMAPARSE_API_KEY =
  process.env.LLAMAPARSE_API_KEY || process.env.LLAMA_CLOUD_API_KEY;
if (!LLAMAPARSE_API_KEY) {
  throw new Error("LLAMAPARSE_API_KEY is not defined in environment variables");
}

// ============================================================================
// 3. Text Embedding Configuration (Vector Search & Semantic Retrieval)
// ============================================================================
// Embedding models convert text chunks and user search queries into mathematical
// vectors (lists of 512 numbers) for cosine similarity search in PostgreSQL pgvector.
// They DO NOT generate sentences or answers.
//
// - EMBEDDING_PROVIDER: "local" (runs in-process via Transformers.js)
// - EMBEDDING_MODEL: "Xenova/jina-embeddings-v2-small-en" (512-dimensional vector space)
const EMBEDDING_PROVIDER = process.env.EMBEDDING_PROVIDER || "local";
const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL || "Xenova/jina-embeddings-v2-small-en";

// ============================================================================
// 4. LLM Generation Configuration (Answer Synthesis & Reasoning)
// ============================================================================
// Generation models read retrieved document chunks, check evidence sufficiency,
// and synthesize the final answer text with citations.

// ----------------------------------------------------------------------------
// Part A: Individual Provider Settings (Keys, URLs & Models)
// ----------------------------------------------------------------------------
// 1. Groq (Fast Cloud API)
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_MODEL = process.env.GROQ_MODEL || "qwen/qwen3.8-27b";

// 2. Google Gemini (Cloud API)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

// 3. Ollama (Local Machine Server)
const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const OLLAMA_MODEL =
  process.env.OLLAMA_MODEL || "hf.co/unsloth/Qwen3.5-0.8B-GGUF:Q4_K_M";

// ----------------------------------------------------------------------------
// Part B: Active Provider & Model Selection
// ----------------------------------------------------------------------------
// 1. Which provider is active? (Options: "groq" | "gemini" | "ollama")
// Defaults to "groq" if GROQ_API_KEY is set, otherwise "gemini".
const LLM_PROVIDER = process.env.LLM_PROVIDER || "ollama";


// 2. Which model is active?
// Automatically matches the chosen active provider above.
// (Can also be overridden directly with LLM_MODEL in .env).
const resolveActiveModel = (): string => {
  if (process.env.LLM_MODEL) return process.env.LLM_MODEL;

  switch (LLM_PROVIDER.toLowerCase()) {
    case "groq":
      return GROQ_MODEL;
    case "ollama":
      return OLLAMA_MODEL;
    case "gemini":
      return GEMINI_MODEL;
    default:
      return GROQ_MODEL;
  }
};

const LLM_MODEL = resolveActiveModel();

// ============================================================================
// 5. Ingestion Pipeline Configuration
// ============================================================================
// Maximum number of document files processed concurrently in the background queue.
const INGESTION_CONCURRENCY = Math.max(
  1,
  Number(process.env.INGESTION_CONCURRENCY) || 3
);

export {
  // Server & Database
  PORT,
  DATABASE_URL,
  LLAMAPARSE_API_KEY,

  // Text Embedding (Vector Search & Retrieval)
  EMBEDDING_PROVIDER,
  EMBEDDING_MODEL,

  // LLM Generation: Active Selection
  LLM_PROVIDER,
  LLM_MODEL,

  // LLM Generation: Individual Provider Settings
  GROQ_API_KEY,
  GROQ_MODEL,
  GEMINI_API_KEY,
  GEMINI_MODEL,
  OLLAMA_BASE_URL,
  OLLAMA_MODEL,

  // Ingestion Queue
  INGESTION_CONCURRENCY,
};