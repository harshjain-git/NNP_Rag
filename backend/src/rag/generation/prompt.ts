import type { RetrievedChunk } from "../retrieval/types.js";

export const DEFAULT_RAG_SYSTEM_PROMPT = `You are a precise, truth-focused document question-answering assistant.
Your answers MUST be strictly grounded in the provided Evidence Sources.

CRITICAL RULES:
1. Use ONLY the facts directly mentioned in the provided Evidence Sources. Do NOT use outside knowledge, prior knowledge, speculation, or unstated assumptions.
2. If the provided Evidence Sources do not contain sufficient information to directly answer the question, or if they are irrelevant to the question, you MUST decline to answer and respond with EXACTLY:
INSUFFICIENT_EVIDENCE: <brief explanation of what information is missing>
3. If the evidence IS sufficient, answer the user's question clearly, concisely, and accurately based only on the sources.
4. Always cite your sources in the text using bracketed source tags like [Source 1], [Source 2] immediately following the facts they support.
5. Do NOT invent or make up citations. Only cite sources provided in the Evidence Sources list.`;

export const formatEvidenceContext = (chunks: RetrievedChunk[]): string => {
  if (chunks.length === 0) {
    return "No evidence sources available.";
  }

  return chunks
    .map((chunk, index) => {
      const sourceNum = index + 1;
      const pageInfo =
        chunk.pageNumber !== null && chunk.pageNumber !== undefined
          ? `, Page: ${chunk.pageNumber}`
          : "";
      return `[Source ${sourceNum}] (Document: "${chunk.filename}"${pageInfo}, Chunk: ${chunk.chunkIndex}):\n${chunk.content}`;
    })
    .join("\n\n");
};

export const buildRAGPrompt = (
  query: string,
  chunks: RetrievedChunk[],
  customSystemPrompt?: string
): { systemPrompt: string; userPrompt: string } => {
  const systemPrompt = customSystemPrompt || DEFAULT_RAG_SYSTEM_PROMPT;
  const context = formatEvidenceContext(chunks);

  const userPrompt = `EVIDENCE SOURCES:
${context}

USER QUESTION:
${query}

Provide a direct, grounded answer with citations ([Source X]). If the sources do not provide sufficient information to answer the question, output "INSUFFICIENT_EVIDENCE: <reason>".`;

  return { systemPrompt, userPrompt };
};
