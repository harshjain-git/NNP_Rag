import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { inArray, eq } from "drizzle-orm";
import app from "../src/app.js";
import { db, pool } from "../src/database/client.js";
import { prompts, users, roles, ROLE_NAMES, PROMPT_TYPES, PROMPT_STATUSES } from "../src/database/schema.js";
import { JWT_SECRET } from "../src/config/env.js";

describe("Prompt Management APIs (/api/prompts)", () => {
  let server: http.Server;
  let baseUrl: string;

  const adminId = crypto.randomUUID();
  const superAdminId = crypto.randomUUID();
  const regularUserId = crypto.randomUUID();

  const adminToken = jwt.sign(
    { sub: adminId, role: ROLE_NAMES.ADMIN },
    JWT_SECRET
  );
  const superAdminToken = jwt.sign(
    { sub: superAdminId, role: ROLE_NAMES.SUPER_ADMIN },
    JWT_SECRET
  );
  const userToken = jwt.sign(
    { sub: regularUserId, role: ROLE_NAMES.USER },
    JWT_SECRET
  );

  const cleanupIds: string[] = [];
  const cleanupUserIds: string[] = [adminId, superAdminId, regularUserId];

  before(async () => {
    const [adminRole] = await db.select({ id: roles.id }).from(roles).where(eq(roles.name, ROLE_NAMES.ADMIN)).limit(1);
    const [superAdminRole] = await db.select({ id: roles.id }).from(roles).where(eq(roles.name, ROLE_NAMES.SUPER_ADMIN)).limit(1);
    const [userRole] = await db.select({ id: roles.id }).from(roles).where(eq(roles.name, ROLE_NAMES.USER)).limit(1);

    await db.insert(users).values([
      { id: adminId, name: "Test Admin", email: `prompt-admin-${Date.now()}@example.com`, passwordHash: "dummy", roleId: adminRole!.id },
      { id: superAdminId, name: "Test Super Admin", email: `prompt-sa-${Date.now()}@example.com`, passwordHash: "dummy", roleId: superAdminRole!.id },
      { id: regularUserId, name: "Test User", email: `prompt-u-${Date.now()}@example.com`, passwordHash: "dummy", roleId: userRole!.id },
    ]);

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
    if (cleanupIds.length > 0) {
      await db.delete(prompts).where(inArray(prompts.id, cleanupIds));
    }
    if (cleanupUserIds.length > 0) {
      await db.delete(users).where(inArray(users.id, cleanupUserIds));
    }
    await pool.end();
  });


  describe("Authentication & RBAC Access Control", () => {
    it("should return 401 when called without authorization header", async () => {
      const res = await fetch(`${baseUrl}/api/prompts`);
      assert.equal(res.status, 401);
    });

    it("should return 403 when called by standard USER role", async () => {
      const res = await fetch(`${baseUrl}/api/prompts`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      assert.equal(res.status, 403);
    });

    it("should allow ADMIN role to access prompts endpoint", async () => {
      const res = await fetch(`${baseUrl}/api/prompts`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(res.status, 200);
    });

    it("should allow SUPER_ADMIN role to access prompts endpoint", async () => {
      const res = await fetch(`${baseUrl}/api/prompts`, {
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      assert.equal(res.status, 200);
    });
  });

  describe("POST /api/prompts — Creation & Validation", () => {
    it("should return 400 when prompt name is missing or empty", async () => {
      const res = await fetch(`${baseUrl}/api/prompts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ content: "Valid content" }),
      });
      assert.equal(res.status, 400);
      const data = (await res.json()) as { error: string };
      assert.equal(data.error, "Prompt name is required");
    });

    it("should return 400 when prompt content is missing or empty", async () => {
      const res = await fetch(`${baseUrl}/api/prompts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ name: `p-${Date.now()}` }),
      });
      assert.equal(res.status, 400);
      const data = (await res.json()) as { error: string };
      assert.equal(data.error, "Prompt content is required");
    });

    it("should return 400 when type or status is invalid", async () => {
      const res = await fetch(`${baseUrl}/api/prompts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: `p-${Date.now()}`,
          content: "Valid",
          type: "invalid_type",
        }),
      });
      assert.equal(res.status, 400);
    });

    it("should successfully create a prompt with default type and status", async () => {
      const promptName = `test-prompt-${Date.now()}`;
      const res = await fetch(`${baseUrl}/api/prompts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: promptName,
          content: "Test grounding prompt instructions.",
        }),
      });

      assert.equal(res.status, 201);
      const data = (await res.json()) as {
        message: string;
        prompt: { id: string; name: string; type: string; status: string };
      };
      assert.ok(data.prompt.id);
      cleanupIds.push(data.prompt.id);
      assert.equal(data.prompt.name, promptName);
      assert.equal(data.prompt.type, PROMPT_TYPES.SYSTEM);
      assert.equal(data.prompt.status, PROMPT_STATUSES.ACTIVE);
    });

    it("should return 409 conflict when creating a prompt with existing name", async () => {
      const promptName = `conflict-prompt-${Date.now()}`;
      const res1 = await fetch(`${baseUrl}/api/prompts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: promptName,
          content: "First definition",
        }),
      });
      assert.equal(res1.status, 201);
      const data1 = (await res1.json()) as { prompt: { id: string } };
      cleanupIds.push(data1.prompt.id);

      const res2 = await fetch(`${baseUrl}/api/prompts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: promptName,
          content: "Second definition",
        }),
      });
      assert.equal(res2.status, 409);
      const data2 = (await res2.json()) as { error: string };
      assert.equal(data2.error, "Prompt name already exists");
    });
  });

  describe("GET /api/prompts, GET /:id, & Active Prompt Selection", () => {
    let promptId1: string;
    let promptId2: string;

    before(async () => {
      const res1 = await fetch(`${baseUrl}/api/prompts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: `active-system-1-${Date.now()}`,
          content: "System Prompt Version 1",
          type: PROMPT_TYPES.SYSTEM,
          status: PROMPT_STATUSES.ACTIVE,
        }),
      });
      const data1 = (await res1.json()) as { prompt: { id: string } };
      promptId1 = data1.prompt.id;
      cleanupIds.push(promptId1);

      // Short delay to ensure distinct updated_at timestamp
      await new Promise((r) => setTimeout(r, 100));

      const res2 = await fetch(`${baseUrl}/api/prompts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: `active-system-2-${Date.now()}`,
          content: "System Prompt Version 2",
          type: PROMPT_TYPES.SYSTEM,
          status: PROMPT_STATUSES.ACTIVE,
        }),
      });
      const data2 = (await res2.json()) as { prompt: { id: string } };
      promptId2 = data2.prompt.id;
      cleanupIds.push(promptId2);
    });

    it("should return 400 when prompt ID format is invalid", async () => {
      const res = await fetch(`${baseUrl}/api/prompts/not-a-valid-uuid`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(res.status, 400);
    });

    it("should return 404 when prompt ID does not exist", async () => {
      const res = await fetch(`${baseUrl}/api/prompts/${crypto.randomUUID()}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(res.status, 404);
    });

    it("should fetch prompt by valid ID", async () => {
      const res = await fetch(`${baseUrl}/api/prompts/${promptId1}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(res.status, 200);
      const data = (await res.json()) as { prompt: { id: string; content: string } };
      assert.equal(data.prompt.id, promptId1);
      assert.equal(data.prompt.content, "System Prompt Version 1");
    });

    it("should list prompts and filter by type & status", async () => {
      const res = await fetch(
        `${baseUrl}/api/prompts?type=${PROMPT_TYPES.SYSTEM}&status=${PROMPT_STATUSES.ACTIVE}`,
        {
          headers: { Authorization: `Bearer ${adminToken}` },
        }
      );
      assert.equal(res.status, 200);
      const data = (await res.json()) as { prompts: Array<{ type: string; status: string }> };
      assert.ok(Array.isArray(data.prompts));
      for (const p of data.prompts) {
        assert.equal(p.type, PROMPT_TYPES.SYSTEM);
        assert.equal(p.status, PROMPT_STATUSES.ACTIVE);
      }
    });

    it("should deterministically select the most recently updated active prompt", async () => {
      const res = await fetch(`${baseUrl}/api/prompts/active/system`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(res.status, 200);
      const data = (await res.json()) as { prompt: { id: string; content: string } };
      // promptId2 was created after promptId1, so it should be the active prompt
      assert.equal(data.prompt.id, promptId2);
      assert.equal(data.prompt.content, "System Prompt Version 2");
    });
  });

  describe("PATCH /api/prompts/:id & DELETE /api/prompts/:id", () => {
    let targetPromptId: string;

    before(async () => {
      const res = await fetch(`${baseUrl}/api/prompts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: `lifecycle-prompt-${Date.now()}`,
          content: "Initial content",
          status: PROMPT_STATUSES.DRAFT,
        }),
      });
      const data = (await res.json()) as { prompt: { id: string } };
      targetPromptId = data.prompt.id;
      cleanupIds.push(targetPromptId);
    });

    it("should return 400 when update body has no valid fields", async () => {
      const res = await fetch(`${baseUrl}/api/prompts/${targetPromptId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({}),
      });
      assert.equal(res.status, 400);
    });

    it("should successfully update prompt content and transition status to active", async () => {
      const res = await fetch(`${baseUrl}/api/prompts/${targetPromptId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          content: "Updated prompt content",
          status: PROMPT_STATUSES.ACTIVE,
        }),
      });

      assert.equal(res.status, 200);
      const data = (await res.json()) as {
        prompt: { content: string; status: string };
      };
      assert.equal(data.prompt.content, "Updated prompt content");
      assert.equal(data.prompt.status, PROMPT_STATUSES.ACTIVE);
    });

    it("should successfully delete a prompt and return 404 on subsequent fetch", async () => {
      const res = await fetch(`${baseUrl}/api/prompts/${targetPromptId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(res.status, 200);
      const data = (await res.json()) as { message: string; id: string };
      assert.equal(data.id, targetPromptId);

      const fetchRes = await fetch(`${baseUrl}/api/prompts/${targetPromptId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(fetchRes.status, 404);
    });
  });
});
