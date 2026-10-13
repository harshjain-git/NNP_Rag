import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { generateAnswer } from "../src/rag/generation/generator.js";
import { DEFAULT_RAG_SYSTEM_PROMPT } from "../src/rag/generation/prompt.js";
import { DEFAULT_INSUFFICIENT_EVIDENCE_MESSAGE } from "../src/config/rag.js";
import { promptsService } from "../src/services/prompts.service.js";
import type { RetrievedChunk } from "../src/rag/retrieval/types.js";
import type { GenerateOptions, LLMProvider } from "../src/providers/llm/types.js";

const createSampleChunk = (overrides?: Partial<RetrievedChunk>): RetrievedChunk => ({
  id: "test-chunk-1",
  documentId: "test-doc-1",
  filename: "company_policy.pdf",
  pageNumber: 3,
  chunkIndex: 2,
  content: "Employees are eligible for 20 days of paid annual leave per year.",
  similarity: 0.88,
  metadata: { section: "leave-policy" },
  ...overrides,
});

interface RecordedCall {
  prompt: string;
  options?: GenerateOptions | undefined;
}

const createMockLLMProvider = (
  response = "Employees are entitled to 20 days of paid leave [Source 1]."
): LLMProvider & { calls: RecordedCall[] } => {
  const calls: RecordedCall[] = [];
  return {
    providerName: "mock-test-llm",
    modelName: "mock-test-model-v1",
    calls,
    generate: async (prompt: string, options?: GenerateOptions): Promise<string> => {
      calls.push({ prompt, options });
      return response;
    },
  };
};

describe("RAG Generator Prompt Integration (Phase 4)", () => {
  it("1. should use explicit options.systemPrompt and NOT query the database", async () => {
    const promptSpy = mock.method(promptsService, "getActivePrompt", async () => {
      throw new Error("Database should not be queried when options.systemPrompt is provided");
    });

    const mockLLM = createMockLLMProvider();
    const explicitPrompt = "You are a custom corporate policy compliance assistant.";

    const result = await generateAnswer("How many leave days do I have?", {
      systemPrompt: explicitPrompt,
      retriever: async () => [createSampleChunk()],
      llmProvider: mockLLM,
    });

    assert.equal(promptSpy.mock.callCount(), 0, "getActivePrompt must not be called when explicit prompt is provided");
    assert.equal(mockLLM.calls.length, 1);
    assert.equal(mockLLM.calls[0]!.options?.systemPrompt, explicitPrompt);
    assert.equal(result.evidenceSufficient, true);
    assert.equal(result.modelName, "mock-test-model-v1");

    promptSpy.mock.restore();
  });

  it("2. should use active system prompt from database when no explicit override is provided", async () => {
    const activeDbPromptContent = "You are an active legal advisor strictly checking document facts.";
    const promptSpy = mock.method(promptsService, "getActivePrompt", async (type) => {
      assert.equal(type, "system");
      return {
        id: "prompt-uuid-1",
        name: "Active Legal Advisor",
        content: activeDbPromptContent,
        type: "system",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
      };
    });

    const mockLLM = createMockLLMProvider();

    const result = await generateAnswer("How many leave days do I have?", {
      retriever: async () => [createSampleChunk()],
      llmProvider: mockLLM,
    });

    assert.equal(promptSpy.mock.callCount(), 1, "getActivePrompt must be queried exactly once");
    assert.equal(mockLLM.calls.length, 1);
    assert.equal(mockLLM.calls[0]!.options?.systemPrompt, activeDbPromptContent);
    assert.equal(result.evidenceSufficient, true);

    promptSpy.mock.restore();
  });

  it("3. should fall back to DEFAULT_RAG_SYSTEM_PROMPT when no active prompt exists in database", async () => {
    const promptSpy = mock.method(promptsService, "getActivePrompt", async (type) => {
      assert.equal(type, "system");
      return null;
    });

    const mockLLM = createMockLLMProvider();

    const result = await generateAnswer("How many leave days do I have?", {
      retriever: async () => [createSampleChunk()],
      llmProvider: mockLLM,
    });

    assert.equal(promptSpy.mock.callCount(), 1, "getActivePrompt must be queried exactly once");
    assert.equal(mockLLM.calls.length, 1);
    assert.equal(mockLLM.calls[0]!.options?.systemPrompt, DEFAULT_RAG_SYSTEM_PROMPT);
    assert.equal(result.evidenceSufficient, true);

    promptSpy.mock.restore();
  });

  it("4. should fall back to DEFAULT_RAG_SYSTEM_PROMPT and log warning if database query fails", async () => {
    const promptSpy = mock.method(promptsService, "getActivePrompt", async () => {
      throw new Error("Simulated PostgreSQL connection timeout");
    });

    let warnMessage = "";
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnMessage = args.map(String).join(" ");
    };

    try {
      const mockLLM = createMockLLMProvider();

      const result = await generateAnswer("How many leave days do I have?", {
        retriever: async () => [createSampleChunk()],
        llmProvider: mockLLM,
      });

      assert.equal(promptSpy.mock.callCount(), 1);
      assert.ok(warnMessage.includes("Failed to retrieve active system prompt"), "Warning must be logged on failure");
      assert.ok(warnMessage.includes("Simulated PostgreSQL connection timeout"));
      assert.equal(mockLLM.calls.length, 1);
      assert.equal(mockLLM.calls[0]!.options?.systemPrompt, DEFAULT_RAG_SYSTEM_PROMPT);
      assert.equal(result.evidenceSufficient, true);
    } finally {
      console.warn = originalWarn;
      promptSpy.mock.restore();
    }
  });

  describe("5. Preserve Existing Generation Behavior (Retrieval, Sufficiency, Citations)", () => {
    it("5a. should decline answer when query is empty or whitespace", async () => {
      const result = await generateAnswer("   \n\t  ");
      assert.equal(result.evidenceSufficient, false);
      assert.equal(result.answer, DEFAULT_INSUFFICIENT_EVIDENCE_MESSAGE);
      assert.equal(result.refusalReason, "Empty query provided.");
      assert.deepEqual(result.citations, []);
      assert.deepEqual(result.retrievedChunks, []);
    });

    it("5b. should decline answer when retrieval returns 0 chunks", async () => {
      const mockLLM = createMockLLMProvider();
      const result = await generateAnswer("Topic with no match", {
        retriever: async () => [],
        llmProvider: mockLLM,
      });

      assert.equal(result.evidenceSufficient, false);
      assert.equal(result.answer, DEFAULT_INSUFFICIENT_EVIDENCE_MESSAGE);
      assert.ok(result.refusalReason?.includes("No relevant documents"));
      assert.deepEqual(result.citations, []);
      assert.equal(mockLLM.calls.length, 0, "LLM should not be invoked when evidence is insufficient");
    });

    it("5c. should decline answer when retrieval top similarity is below minSufficiencyScore", async () => {
      const mockLLM = createMockLLMProvider();
      const result = await generateAnswer("Question with low relevance", {
        retriever: async () => [createSampleChunk({ similarity: 0.25 })],
        minSufficiencyScore: 0.60,
        llmProvider: mockLLM,
      });

      assert.equal(result.evidenceSufficient, false);
      assert.equal(result.answer, DEFAULT_INSUFFICIENT_EVIDENCE_MESSAGE);
      assert.ok(result.refusalReason?.includes("below the required sufficiency threshold"));
      assert.equal(mockLLM.calls.length, 0, "LLM should not be called when similarity threshold is not met");
    });

    it("5d. should handle INSUFFICIENT_EVIDENCE sentinel returned by LLM", async () => {
      const promptSpy = mock.method(promptsService, "getActivePrompt", async () => null);
      const mockLLM = createMockLLMProvider("INSUFFICIENT_EVIDENCE: The document does not specify sick leave rules.");

      const result = await generateAnswer("How many sick days?", {
        retriever: async () => [createSampleChunk()],
        llmProvider: mockLLM,
      });

      assert.equal(result.evidenceSufficient, false);
      assert.equal(result.answer, DEFAULT_INSUFFICIENT_EVIDENCE_MESSAGE);
      assert.equal(result.refusalReason, "The document does not specify sick leave rules.");
      assert.deepEqual(result.citations, []);

      promptSpy.mock.restore();
    });

    it("5e. should extract citations matching [Source N] tags in LLM answer", async () => {
      const promptSpy = mock.method(promptsService, "getActivePrompt", async () => null);
      const chunk1 = createSampleChunk({ id: "chunk-a", filename: "handbook.pdf", pageNumber: 5, chunkIndex: 0 });
      const chunk2 = createSampleChunk({ id: "chunk-b", filename: "benefits.pdf", pageNumber: 12, chunkIndex: 3 });

      const mockLLM = createMockLLMProvider("Leave is granted per [Source 2], subject to manager approval [Source 1].");

      const result = await generateAnswer("Explain leave policy", {
        retriever: async () => [chunk1, chunk2],
        llmProvider: mockLLM,
      });

      assert.equal(result.evidenceSufficient, true);
      assert.equal(result.citations.length, 2);
      const filenames = result.citations.map((c) => c.filename);
      assert.ok(filenames.includes("handbook.pdf"));
      assert.ok(filenames.includes("benefits.pdf"));

      promptSpy.mock.restore();
    });
  });
});
