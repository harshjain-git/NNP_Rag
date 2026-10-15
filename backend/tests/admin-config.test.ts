import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import app from "../src/app.js";
import { ROLE_NAMES } from "../src/database/schema.js";
import { JWT_SECRET } from "../src/config/env.js";
import { ingestionQueue } from "../src/rag/ingestion/queue.js";
import { getLLMProvider } from "../src/providers/llm/index.js";

describe("Super Admin Project Configuration APIs (/api/admin/config)", () => {
  let server: http.Server;
  let baseUrl: string;

  const superAdminId = crypto.randomUUID();
  const adminId = crypto.randomUUID();
  const regularUserId = crypto.randomUUID();

  const superAdminToken = jwt.sign(
    { sub: superAdminId, role: ROLE_NAMES.SUPER_ADMIN },
    JWT_SECRET
  );
  const adminToken = jwt.sign(
    { sub: adminId, role: ROLE_NAMES.ADMIN },
    JWT_SECRET
  );
  const userToken = jwt.sign(
    { sub: regularUserId, role: ROLE_NAMES.USER },
    JWT_SECRET
  );

  before(async () => {
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
  });

  describe("GET /api/admin/config", () => {
    it("should return 401 when unauthenticated", async () => {
      const res = await fetch(`${baseUrl}/api/admin/config`);
      assert.equal(res.status, 401);
    });

    it("should return 403 when called by standard USER", async () => {
      const res = await fetch(`${baseUrl}/api/admin/config`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      assert.equal(res.status, 403);
    });

    it("should return 403 when called by regular ADMIN", async () => {
      const res = await fetch(`${baseUrl}/api/admin/config`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(res.status, 403);
    });

    it("should return 200 with sanitized config for SUPER_ADMIN", async () => {
      const res = await fetch(`${baseUrl}/api/admin/config`, {
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      assert.equal(res.status, 200);

      const data = (await res.json()) as { config: Record<string, unknown> };
      assert.ok(data.config);
      const config = data.config as any;

      // Models assertions
      assert.ok(config.models);
      assert.ok(["groq", "gemini", "ollama"].includes(config.models.llmProvider));
      assert.equal(config.models.embeddingProvider, "local");
      assert.equal(config.models.embeddingDimension, 512);

      // Verify NO SECRETS or API keys exist in config response
      assert.equal(config.models.groqApiKey, undefined);
      assert.equal(config.models.geminiApiKey, undefined);
      assert.equal(config.models.apiKey, undefined);
      assert.equal(config.jwtSecret, undefined);
      assert.equal(config.databaseUrl, undefined);

      // Retrieval assertions
      assert.ok(config.retrieval);
      assert.equal(typeof config.retrieval.topK, "number");
      assert.equal(typeof config.retrieval.minSimilarity, "number");
      assert.equal(typeof config.retrieval.minSufficiencyScore, "number");

      // Chunking assertions
      assert.ok(config.chunking);
      assert.equal(typeof config.chunking.structuralTarget, "number");

      // Generation assertions
      assert.ok(config.generation);
      assert.equal(typeof config.generation.temperature, "number");
      assert.equal(typeof config.generation.maxTokens, "number");

      // System assertions
      assert.ok(config.system);
      assert.equal(typeof config.system.ingestionConcurrency, "number");
    });
  });

  describe("PATCH /api/admin/config", () => {
    it("should return 401 when unauthenticated", async () => {
      const res = await fetch(`${baseUrl}/api/admin/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retrieval: { topK: 7 } }),
      });
      assert.equal(res.status, 401);
    });

    it("should return 403 when called by standard USER or regular ADMIN", async () => {
      const userRes = await fetch(`${baseUrl}/api/admin/config`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({ retrieval: { topK: 7 } }),
      });
      assert.equal(userRes.status, 403);

      const adminRes = await fetch(`${baseUrl}/api/admin/config`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ retrieval: { topK: 7 } }),
      });
      assert.equal(adminRes.status, 403);
    });

    it("should return 400 when unsupported LLM provider is requested", async () => {
      const res = await fetch(`${baseUrl}/api/admin/config`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({ models: { llmProvider: "unsupported-provider" } }),
      });
      assert.equal(res.status, 400);
      const data = (await res.json()) as { error: string };
      assert.ok(data.error.includes("Invalid LLM provider"));
    });

    it("should return 400 when attempting to switch embedding provider away from local", async () => {
      const res = await fetch(`${baseUrl}/api/admin/config`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({ models: { embeddingProvider: "pinecone" } }),
      });
      assert.equal(res.status, 400);
      const data = (await res.json()) as { error: string };
      assert.ok(data.error.includes("Only 'local' embedding provider is supported"));
    });

    it("should return 400 when retrieval parameters are invalid", async () => {
      const res = await fetch(`${baseUrl}/api/admin/config`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({ retrieval: { topK: -5 } }),
      });
      assert.equal(res.status, 400);
      const data = (await res.json()) as { error: string };
      assert.ok(data.error.includes("topK must be an integer between 1 and 50"));
    });

    it("should return 400 when generation temperature is out of range", async () => {
      const res = await fetch(`${baseUrl}/api/admin/config`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({ generation: { temperature: 2.5 } }),
      });
      assert.equal(res.status, 400);
      const data = (await res.json()) as { error: string };
      assert.ok(data.error.includes("temperature must be a number between 0.0 and 1.0"));
    });

    it("should successfully update and persist valid configuration settings", async () => {
      const updatePayload = {
        retrieval: {
          topK: 8,
          minSimilarity: 0.55,
          minSufficiencyScore: 0.7,
        },
        generation: {
          temperature: 0.2,
          maxTokens: 1500,
        },
        system: {
          ingestionConcurrency: 4,
        },
      };

      const res = await fetch(`${baseUrl}/api/admin/config`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify(updatePayload),
      });

      assert.equal(res.status, 200);
      const data = (await res.json()) as { message: string; config: any };
      assert.equal(data.config.retrieval.topK, 8);
      assert.equal(data.config.retrieval.minSimilarity, 0.55);
      assert.equal(data.config.retrieval.minSufficiencyScore, 0.7);
      assert.equal(data.config.generation.temperature, 0.2);
      assert.equal(data.config.generation.maxTokens, 1500);
      assert.equal(data.config.system.ingestionConcurrency, 4);

      // Verify runtime pipeline consumption
      assert.equal(ingestionQueue.getStatus().concurrencyLimit, 4);

      // Verify subsequent GET returns the updated values
      const verifyRes = await fetch(`${baseUrl}/api/admin/config`, {
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      assert.equal(verifyRes.status, 200);
      const verifyData = (await verifyRes.json()) as { config: any };
      assert.equal(verifyData.config.retrieval.topK, 8);
      assert.equal(verifyData.config.system.ingestionConcurrency, 4);

      // Verify LLM provider and model runtime update
      const modelRes = await fetch(`${baseUrl}/api/admin/config`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          models: {
            llmProvider: "groq",
            llmModel: "llama-3.3-70b-speculative",
          },
        }),
      });
      assert.equal(modelRes.status, 200);
      const activeLLM = getLLMProvider();
      assert.equal(activeLLM.providerName, "groq");
      assert.equal(activeLLM.modelName, "llama-3.3-70b-speculative");
    });
  });
});
