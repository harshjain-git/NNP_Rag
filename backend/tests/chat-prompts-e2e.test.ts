import { describe, it, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import app from "../src/app.js";
import { JWT_SECRET } from "../src/config/env.js";
import { ROLE_NAMES } from "../src/database/schema.js";
import { promptsService } from "../src/services/prompts.service.js";
import { chunkRetriever } from "../src/rag/retrieval/retriever.js";
import { getLLMProvider, GroqLLMProvider, OllamaLLMProvider, GeminiLLMProvider } from "../src/providers/llm/index.js";
import { db, pool } from "../src/database/client.js";
import { users, roles } from "../src/database/schema.js";
import { eq } from "drizzle-orm";
import type { RetrievedChunk } from "../src/rag/retrieval/types.js";
import type { GenerateOptions } from "../src/providers/llm/types.js";

const mockEvidenceChunk: RetrievedChunk = {
  id: "e2e-chunk-1",
  documentId: "doc-uuid-1",
  filename: "benefits_handbook.pdf",
  pageNumber: 4,
  chunkIndex: 1,
  content: "Employees are eligible for 20 paid vacation days each calendar year.",
  similarity: 0.92,
  metadata: {},
};

describe("End-to-End Chat System Prompt Integration (POST /api/chat)", () => {
  let server: http.Server;
  let baseUrl: string;

  const testUserId = crypto.randomUUID();
  const testUserEmail = `chat-e2e-user-${Date.now()}@test.com`;
  const testToken = jwt.sign(
    { sub: testUserId, role: ROLE_NAMES.USER },
    JWT_SECRET
  );

  let capturedSystemPrompt: string | undefined;
  let providerCalls = 0;

  before(async () => {
    // 1. Seed test user to satisfy conversations foreign key constraint
    const [userRole] = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, ROLE_NAMES.USER))
      .limit(1);

    if (userRole) {
      await db.insert(users).values({
        id: testUserId,
        name: "Chat E2E Test User",
        email: testUserEmail,
        passwordHash: "dummy-hash",
        roleId: userRole.id,
      });
    }

    // 2. Mock chunkRetriever to provide valid evidence above sufficiency threshold
    mock.method(chunkRetriever, "retrieveChunks", async () => [mockEvidenceChunk]);

    // 3. Mock active LLM providers to intercept generation options and avoid external network calls
    const mockGenerate = async function (_prompt: string, options?: GenerateOptions): Promise<string> {
      providerCalls++;
      capturedSystemPrompt = options?.systemPrompt;
      return "According to company policy, employees receive 20 days [Source 1].";
    };
    const mockGenerateStream = async function (_prompt: string, onToken: (t: string) => Promise<void> | void, options?: any): Promise<string> {
      providerCalls++;
      capturedSystemPrompt = options?.systemPrompt;
      const text = "According to company policy, employees receive 20 days [Source 1].";
      await onToken(text);
      return text;
    };

    mock.method(GroqLLMProvider.prototype, "generate", mockGenerate);
    mock.method(GroqLLMProvider.prototype, "generateStream", mockGenerateStream);
    mock.method(OllamaLLMProvider.prototype, "generate", mockGenerate);
    mock.method(OllamaLLMProvider.prototype, "generateStream", mockGenerateStream);
    mock.method(GeminiLLMProvider.prototype, "generate", mockGenerate);
    mock.method(GeminiLLMProvider.prototype, "generateStream", mockGenerateStream);

    // 4. Start test server on ephemeral port
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
    await db.delete(users).where(eq(users.id, testUserId));
    await pool.end();
    mock.reset();
  });

  it("should forward explicit systemPrompt from request body and skip prompt DB lookup", async () => {
    const explicitOverride = "You are a specialized corporate benefits advisor.";
    const promptSpy = mock.method(promptsService, "getActivePrompt", async () => {
      throw new Error("Database should NOT be queried when systemPrompt is explicitly provided");
    });

    capturedSystemPrompt = undefined;
    providerCalls = 0;

    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${testToken}`,
      },
      body: JSON.stringify({
        query: "How many vacation days do I get?",
        systemPrompt: explicitOverride,
      }),
    });

    assert.equal(res.status, 200);
    const data = (await res.json()) as {
      answer: string;
      evidenceSufficient: boolean;
    };

    assert.equal(data.evidenceSufficient, true);
    assert.equal(promptSpy.mock.callCount(), 0, "Database must NOT be queried when systemPrompt is provided");
    assert.equal(capturedSystemPrompt, explicitOverride);
    assert.equal(providerCalls, 1);

    promptSpy.mock.restore();
  });

  it("should return HTTP 400 when systemPrompt is provided but is not a string", async () => {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${testToken}`,
      },
      body: JSON.stringify({
        query: "How many vacation days?",
        systemPrompt: 9999,
      }),
    });

    assert.equal(res.status, 400);
    const data = (await res.json()) as { error: string };
    assert.equal(data.error, "systemPrompt must be a string");
  });

  it("should use active database system prompt when systemPrompt is omitted", async () => {
    const activeDbContent = "You are an active legal advisor strictly checking document facts.";
    const promptSpy = mock.method(promptsService, "getActivePrompt", async (type) => {
      assert.equal(type, "system");
      return {
        id: "prompt-1",
        name: "Active Legal Advisor",
        content: activeDbContent,
        type: "system",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
      };
    });

    capturedSystemPrompt = undefined;
    providerCalls = 0;

    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${testToken}`,
      },
      body: JSON.stringify({ query: "How many vacation days do I get?" }),
    });

    assert.equal(res.status, 200);
    const data = (await res.json()) as {
      answer: string;
      evidenceSufficient: boolean;
      citations: Array<{ filename: string }>;
    };

    assert.equal(data.evidenceSufficient, true);
    assert.equal(promptSpy.mock.callCount(), 1, "getActivePrompt must be called once per chat request");
    assert.equal(capturedSystemPrompt, activeDbContent);
    assert.equal(providerCalls, 1);
    assert.equal(data.citations.length, 1);

    promptSpy.mock.restore();
  });
});
