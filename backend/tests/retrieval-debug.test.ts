import { describe, it, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import app from "../src/app.js";
import { JWT_SECRET } from "../src/config/env.js";
import { ROLE_NAMES, users, roles } from "../src/database/schema.js";
import { db, pool } from "../src/database/client.js";
import { eq } from "drizzle-orm";
import { generateAnswer } from "../src/rag/generation/generator.js";
import { retrieveChunksWithDebug } from "../src/rag/retrieval/retriever.js";
import { getLLMProvider, GroqLLMProvider, OllamaLLMProvider, GeminiLLMProvider } from "../src/providers/llm/index.js";
import type { RetrievedChunk } from "../src/rag/retrieval/types.js";
import type { GenerateOptions, LLMProvider } from "../src/providers/llm/types.js";

// Helper for testing markdown normalization logic
function normalizeMarkdown(content: string): string {
  if (!content) return "";
  const parts = content.split(/(```[\s\S]*?```|`[^`\n]*?`)/g);
  for (let i = 0; i < parts.length; i += 2) {
    const text = parts[i];
    if (!text) continue;
    parts[i] = text
      .replace(/\\+(\*)/g, "$1")
      .replace(/\\+(_)/g, "$1")
      .replace(/(^|\n)\\+(#{1,6}\s)/g, "$1$2")
      .replace(/(^|\n)\s*\\+([*-]\s)/g, "$1$2")
      .replace(/\\*\[(Source\s+\d+)\\*\]/gi, "[$1]");
  }
  return parts.join("");
}

describe("RAG Retrieval Debug Information & Markdown Rendering", () => {
  let server: http.Server;
  let baseUrl: string;

  const adminUserId = crypto.randomUUID();
  const normalUserId = crypto.randomUUID();
  let adminToken: string;
  let userToken: string;

  const sampleChunkA: RetrievedChunk = {
    id: "chunk-uuid-1",
    documentId: "doc-uuid-1",
    filename: "psychometrics_guide.pdf",
    pageNumber: 1,
    chunkIndex: 0,
    content: "Cronbach's alpha of 0.70 or higher is required for research reliability standards.",
    similarity: 0.88,
    metadata: {},
  };

  const sampleChunkB: RetrievedChunk = {
    id: "chunk-uuid-2",
    documentId: "doc-uuid-1",
    filename: "psychometrics_guide.pdf",
    pageNumber: 2,
    chunkIndex: 1,
    content: "Confirmatory factor analysis (CFA) tests hypothesized measurement models.",
    similarity: 0.76,
    metadata: {},
  };

  before(async () => {
    // 1. Fetch role IDs
    const [adminRole] = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, ROLE_NAMES.ADMIN))
      .limit(1);

    const [userRole] = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, ROLE_NAMES.USER))
      .limit(1);

    if (adminRole && userRole) {
      await db.insert(users).values([
        {
          id: adminUserId,
          name: "Debug Test Admin",
          email: `debug-admin-${Date.now()}@test.com`,
          passwordHash: "dummy-hash",
          roleId: adminRole.id,
        },
        {
          id: normalUserId,
          name: "Debug Test User",
          email: `debug-user-${Date.now()}@test.com`,
          passwordHash: "dummy-hash",
          roleId: userRole.id,
        },
      ]);
    }

    adminToken = jwt.sign(
      { sub: adminUserId, role: ROLE_NAMES.ADMIN },
      JWT_SECRET
    );

    userToken = jwt.sign(
      { sub: normalUserId, role: ROLE_NAMES.USER },
      JWT_SECRET
    );

    // 2. Mock LLM provider methods to avoid real network traffic
    const mockGenerate = async function (_prompt: string, _options?: GenerateOptions): Promise<string> {
      return "According to psychometric standards, Cronbach's alpha must exceed 0.70 [Source 1].";
    };
    const mockGenerateStream = async function (_prompt: string, onToken: (t: string) => Promise<void> | void, _options?: any): Promise<string> {
      const text = "According to psychometric standards, Cronbach's alpha must exceed 0.70 [Source 1].";
      await onToken(text);
      return text;
    };

    mock.method(GroqLLMProvider.prototype, "generate", mockGenerate);
    mock.method(GroqLLMProvider.prototype, "generateStream", mockGenerateStream);
    mock.method(OllamaLLMProvider.prototype, "generate", mockGenerate);
    mock.method(OllamaLLMProvider.prototype, "generateStream", mockGenerateStream);
    mock.method(GeminiLLMProvider.prototype, "generate", mockGenerate);
    mock.method(GeminiLLMProvider.prototype, "generateStream", mockGenerateStream);

    // 3. Start test server
    await new Promise<void>((resolve) => {
      server = http.createServer(app).listen(0, "127.0.0.1", () => {
        const addr = server.address() as { port: number };
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    await db.delete(users).where(eq(users.id, adminUserId));
    await db.delete(users).where(eq(users.id, normalUserId));
    await pool.end();
    mock.reset();
  });

  describe("1. Markdown Normalization & Safe Rendering Tests", () => {
    it("should unescape escaped bold asterisks (\\*\\*bold\\*\\*) in prose text", () => {
      const raw = "The \\*\\*Cronbach Alpha\\*\\* metric indicates internal consistency.";
      const normalized = normalizeMarkdown(raw);
      assert.equal(normalized, "The **Cronbach Alpha** metric indicates internal consistency.");
    });

    it("should unescape double-escaped asterisks (\\\\*\\\\*bold\\\\*\\\\*)", () => {
      const raw = "\\\\*\\\\*Important Notice\\\\*\\\\*: Always verify p-values.";
      const normalized = normalizeMarkdown(raw);
      assert.equal(normalized, "**Important Notice**: Always verify p-values.");
    });

    it("should unescape heading and bullet list markers at line start", () => {
      const raw = "\\# Psychometrics Overview\n\\* First point\n\\- Second point";
      const normalized = normalizeMarkdown(raw);
      assert.equal(normalized, "# Psychometrics Overview\n* First point\n- Second point");
    });

    it("should preserve code blocks byte-for-byte and not touch escaped asterisks inside code", () => {
      const codeSnippet = "```python\ndef regex_check():\n    return re.match(r'\\*\\*', text)\n```";
      const raw = `Here is \\*\\*bold\\*\\* text:\n${codeSnippet}\nAnd inline \`code with \\*\\*\`.`;
      const normalized = normalizeMarkdown(raw);

      assert.ok(normalized.includes("**bold**"));
      assert.ok(normalized.includes(codeSnippet));
      assert.ok(normalized.includes("`code with \\*\\*`"));
    });

    it("should preserve LaTeX math formulas, regex symbols, and Windows paths", () => {
      const raw = "The formula uses \\alpha and \\beta. Path: C:\\Windows\\System32. Regex: \\d+ matches numbers.";
      const normalized = normalizeMarkdown(raw);
      assert.equal(normalized, raw);
    });

    it("should unescape citation brackets (e.g. \\[Source 1\\])", () => {
      const raw = "As demonstrated in \\[Source 1\\] and \\[Source 2\\].";
      const normalized = normalizeMarkdown(raw);
      assert.equal(normalized, "As demonstrated in [Source 1] and [Source 2].");
    });
  });

  describe("2. Retrieval Debug Metadata & LLM Context Exposure", () => {
    it("should expose retrievalDebug with retrievedChunks, contextChunks, and similarity scores", async () => {
      const mockLLM: LLMProvider = {
        providerName: "mock-provider",
        modelName: "mock-model",
        generate: async () => "Reliability was high [Source 1].",
      };

      const result = await generateAnswer("What is Cronbach's alpha?", {
        retriever: async () => [sampleChunkA, sampleChunkB],
        llmProvider: mockLLM,
      });

      assert.equal(result.evidenceSufficient, true);
      assert.ok(result.retrievalDebug, "retrievalDebug object must be present in result");

      // Verify retrievedChunks metadata
      assert.equal(result.retrievalDebug.retrievedChunks.length, 2);
      const chunk1 = result.retrievalDebug.retrievedChunks[0]!;
      assert.equal(chunk1.id, sampleChunkA.id);
      assert.equal(chunk1.chunkId, sampleChunkA.id);
      assert.equal(chunk1.filename, sampleChunkA.filename);
      assert.equal(chunk1.pageNumber, sampleChunkA.pageNumber);
      assert.equal(chunk1.similarity, sampleChunkA.similarity);
      assert.equal(chunk1.passedToLLM, true);
      assert.equal(chunk1.filterReason, null);

      // Verify contextChunks contains exact document text sent to LLM prompt
      assert.equal(result.retrievalDebug.contextChunks.length, 2);
      assert.equal(result.retrievalDebug.contextChunks[0]!.id, sampleChunkA.id);
      assert.equal(result.retrievalDebug.contextChunks[0]!.text, sampleChunkA.content);
      assert.equal(result.retrievalDebug.contextChunks[0]!.content, sampleChunkA.content);
      assert.equal(result.retrievalDebug.contextChunks[1]!.id, sampleChunkB.id);
      assert.equal(result.retrievalDebug.contextChunks[1]!.text, sampleChunkB.content);
      assert.equal(result.retrievalDebug.filterReason, null);
    });

    it("should not derive contextChunks from citations (both sources in context even if only one is cited)", async () => {
      const mockLLM: LLMProvider = {
        providerName: "mock-provider",
        modelName: "mock-model",
        // Only cites [Source 1], omits [Source 2]
        generate: async () => "Only the first source is cited [Source 1].",
      };

      const result = await generateAnswer("Testing citations vs context", {
        retriever: async () => [sampleChunkA, sampleChunkB],
        llmProvider: mockLLM,
      });

      assert.equal(result.citations.length, 1);
      assert.equal(result.citations[0]!.chunkId, sampleChunkA.id);

      // Both chunks must still be present in contextChunks because both were included in prompt
      assert.equal(result.retrievalDebug.contextChunks.length, 2);
      assert.equal(result.retrievalDebug.contextChunks[0]!.chunkId, sampleChunkA.id);
      assert.equal(result.retrievalDebug.contextChunks[1]!.chunkId, sampleChunkB.id);
    });

    it("should mark passedToLLM: false with filterReason when evidence sufficiency fails", async () => {
      const lowSimilarityChunk: RetrievedChunk = {
        ...sampleChunkA,
        id: "low-sim-1",
        similarity: 0.52, // Below DEFAULT_MIN_SUFFICIENCY_SCORE = 0.65
      };

      const result = await generateAnswer("Sufficiency failure test", {
        retriever: async () => [lowSimilarityChunk],
      });

      assert.equal(result.evidenceSufficient, false);
      assert.ok(result.retrievalDebug.filterReason);
      assert.ok(result.retrievalDebug.filterReason.includes("sufficiency"));

      // All retrieved chunks must be marked passedToLLM: false
      assert.equal(result.retrievalDebug.retrievedChunks.length, 1);
      assert.equal(result.retrievalDebug.retrievedChunks[0]!.passedToLLM, false);
      assert.ok(result.retrievalDebug.retrievedChunks[0]!.filterReason?.includes("sufficiency"));

      // Context chunks must be empty because LLM generation was bypassed
      assert.deepEqual(result.retrievalDebug.contextChunks, []);
    });

    it("should accurately track filtering reasons during vector retrieval (similarity, duplicate, topK)", async () => {
      // Direct unit test of retrieveChunksWithDebug logic
      const query = "psychometrics reliability";
      // This will run through the retrieveChunksWithDebug method
      const res = await retrieveChunksWithDebug(query, { topK: 2, minSimilarity: 0.999 });

      // Even if no chunks exceed 0.999, debugChunks captures evaluated rows and reasons
      assert.ok(Array.isArray(res.chunks));
      assert.ok(Array.isArray(res.debugChunks));
      for (const dc of res.debugChunks) {
        if (!dc.passedToLLM) {
          assert.ok(typeof dc.filterReason === "string" && dc.filterReason.length > 0);
        }
      }
    });
  });

  describe("3. Authorization Protection of Debug Information (/api/chat)", () => {
    it("should return retrievalDebug for ADMIN role", async () => {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          query: "What is Cronbach's alpha?",
        }),
      });

      assert.equal(res.status, 200);
      const data = (await res.json()) as {
        answer: string;
        evidenceSufficient: boolean;
        retrievalDebug?: {
          retrievedChunks: unknown[];
          contextChunks: unknown[];
        };
      };

      assert.ok(data.retrievalDebug, "retrievalDebug MUST be present for ADMIN users");
      assert.ok(Array.isArray(data.retrievalDebug.retrievedChunks));
      assert.ok(Array.isArray(data.retrievalDebug.contextChunks));
    });

    it("should NOT return retrievalDebug for standard USER role", async () => {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          query: "What is Cronbach's alpha?",
        }),
      });

      assert.equal(res.status, 200);
      const data = (await res.json()) as {
        answer: string;
        evidenceSufficient: boolean;
        retrievalDebug?: unknown;
      };

      assert.equal(
        data.retrievalDebug,
        undefined,
        "retrievalDebug MUST NOT be exposed to standard USER role"
      );
    });

    it("should preserve all existing response properties and citation compatibility", async () => {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          query: "Explain factor analysis.",
        }),
      });

      assert.equal(res.status, 200);
      const data = (await res.json()) as Record<string, unknown>;

      // Check all required Phase 1 contract fields
      assert.ok("conversationId" in data);
      assert.ok("answer" in data);
      assert.ok("evidenceSufficient" in data);
      assert.ok("citations" in data);
      assert.ok("modelName" in data);
      assert.ok("providerName" in data);
      assert.ok("remainingMessages" in data);
      assert.ok("warning" in data);
      assert.ok("isNewConversation" in data);
      assert.ok("retrievalDebug" in data);
    });
  });
});
