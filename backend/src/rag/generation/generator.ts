import { retrieveChunks, chunkRetriever } from "../retrieval/retriever.js";
import type { RetrievedChunk, RetrieveOptions } from "../retrieval/types.js";
import { getLLMProvider } from "../../providers/llm/index.js";
import {
  DEFAULT_INSUFFICIENT_EVIDENCE_MESSAGE,
  DEFAULT_MIN_SUFFICIENCY_SCORE,
} from "../../config/rag.js";
import { buildRAGPrompt, DEFAULT_RAG_SYSTEM_PROMPT } from "./prompt.js";
import { checkEvidenceSufficiency } from "./sufficiency.js";
import { promptsService } from "../../services/prompts.service.js";
import type {
  Citation,
  GenerateAnswerOptions,
  GenerateAnswerResult,
} from "./types.js";


const extractCitations = (
  answerText: string,
  retrievedChunks: RetrievedChunk[]
): Citation[] => {
  const sourceMatches = Array.from(
    answerText.matchAll(/\[Source\s+(\d+)\]/gi)
  );

  const citedIndices = new Set<number>();
  for (const match of sourceMatches) {
    const numStr = match[1];
    if (numStr) {
      const num = Number.parseInt(numStr, 10);
      if (!Number.isNaN(num) && num >= 1 && num <= retrievedChunks.length) {
        citedIndices.add(num - 1);
      }
    }
  }

  // If specific sources were cited in the answer, map those; otherwise map all retrieved chunks
  const targetChunks: RetrievedChunk[] = [];
  if (citedIndices.size > 0) {
    for (const idx of citedIndices) {
      const chunk = retrievedChunks[idx];
      if (chunk) {
        targetChunks.push(chunk);
      }
    }
  } else {
    targetChunks.push(...retrievedChunks);
  }

  return targetChunks.map((chunk) => ({
    documentId: chunk.documentId,
    filename: chunk.filename,
    pageNumber: chunk.pageNumber,
    chunkIndex: chunk.chunkIndex,
    chunkId: chunk.id,
    similarity: chunk.similarity,
    snippet:
      chunk.content.length > 200
        ? `${chunk.content.slice(0, 200).trim()}...`
        : chunk.content.trim(),
  }));
};

export const generateAnswer = async (
  query: string,
  options?: GenerateAnswerOptions
): Promise<GenerateAnswerResult> => {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return {
      answer: DEFAULT_INSUFFICIENT_EVIDENCE_MESSAGE,
      evidenceSufficient: false,
      refusalReason: "Empty query provided.",
      citations: [],
      retrievedChunks: [],
      modelName: "none",
      providerName: "none",
    };
  }

  const provider = options?.llmProvider || getLLMProvider();

  // 1. Retrieve relevant chunks using pgvector
  const retrieveOpts: RetrieveOptions = {};
  if (options?.topK !== undefined) retrieveOpts.topK = options.topK;
  if (options?.documentId !== undefined) retrieveOpts.documentId = options.documentId;
  if (options?.minSimilarity !== undefined) retrieveOpts.minSimilarity = options.minSimilarity;
  if (options?.embeddingProvider !== undefined) retrieveOpts.embeddingProvider = options.embeddingProvider;

  const retrieveFn = options?.retriever ?? chunkRetriever.retrieveChunks;
  const retrievedChunks = await retrieveFn(trimmedQuery, retrieveOpts);

  // 2. Pre-generation evidence sufficiency check
  const minScore =
    options?.minSufficiencyScore ?? DEFAULT_MIN_SUFFICIENCY_SCORE;
  const sufficiency = checkEvidenceSufficiency(retrievedChunks, minScore);

  if (!sufficiency.isSufficient) {
    const result: GenerateAnswerResult = {
      answer: DEFAULT_INSUFFICIENT_EVIDENCE_MESSAGE,
      evidenceSufficient: false,
      citations: [],
      retrievedChunks,
      modelName: provider.modelName,
      providerName: provider.providerName,
    };
    if (sufficiency.reason !== undefined) {
      result.refusalReason = sufficiency.reason;
    }
    return result;
  }

  // 3. Resolve system prompt (explicit override > active DB prompt > default fallback)
  let systemPrompt = options?.systemPrompt;
  if (!systemPrompt) {
    try {
      const activePrompt = await promptsService.getActivePrompt("system");
      systemPrompt = activePrompt?.content || DEFAULT_RAG_SYSTEM_PROMPT;
    } catch (error) {
      console.warn("Failed to retrieve active system prompt, falling back to default:", error);
      systemPrompt = DEFAULT_RAG_SYSTEM_PROMPT;
    }
  }

  // 4. Build strictly grounded prompt
  const { systemPrompt: finalSystemPrompt, userPrompt } = buildRAGPrompt(
    trimmedQuery,
    retrievedChunks,
    systemPrompt,
    options?.conversationHistory
  );

  // 5. Generate answer via configured LLM provider
  const rawResponse = await provider.generate(userPrompt, {
    systemPrompt: finalSystemPrompt,
    temperature: options?.temperature ?? 0.1,
    maxTokens: options?.maxTokens ?? 1024,
  });

  // 5. Check if LLM returned insufficient evidence sentinel
  const insufficientMatch = rawResponse.match(
    /^INSUFFICIENT_EVIDENCE:\s*(.*)/is
  );
  if (insufficientMatch) {
    const refusalReason =
      insufficientMatch[1]?.trim() ||
      "The retrieved documents do not contain sufficient evidence to answer this question.";
    return {
      answer: DEFAULT_INSUFFICIENT_EVIDENCE_MESSAGE,
      evidenceSufficient: false,
      refusalReason,
      citations: [],
      retrievedChunks,
      modelName: provider.modelName,
      providerName: provider.providerName,
    };
  }

  // 6. Grounded answer with citations
  const citations = extractCitations(rawResponse, retrievedChunks);

  return {
    answer: rawResponse,
    evidenceSufficient: true,
    citations,
    retrievedChunks,
    modelName: provider.modelName,
    providerName: provider.providerName,
  };
};
