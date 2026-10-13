import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { eq, inArray } from "drizzle-orm";
import app from "../src/app.js";
import { db, pool } from "../src/database/client.js";
import {
  users,
  roles,
  conversations,
  messages,
  ROLE_NAMES,
} from "../src/database/schema.js";
import { JWT_SECRET } from "../src/config/env.js";

describe("Conversation REST APIs (/api/conversations)", () => {
  let server: http.Server;
  let baseUrl: string;

  const userAId = crypto.randomUUID();
  const userBId = crypto.randomUUID();
  const adminId = crypto.randomUUID();
  const superAdminId = crypto.randomUUID();

  const userAEmail = `conv-user-a-${Date.now()}@test.com`;
  const userBEmail = `conv-user-b-${Date.now()}@test.com`;
  const adminEmail = `conv-admin-${Date.now()}@test.com`;
  const superAdminEmail = `conv-super-${Date.now()}@test.com`;

  const tokenUserA = jwt.sign(
    { sub: userAId, role: ROLE_NAMES.USER },
    JWT_SECRET
  );
  const tokenUserB = jwt.sign(
    { sub: userBId, role: ROLE_NAMES.USER },
    JWT_SECRET
  );
  const tokenAdmin = jwt.sign(
    { sub: adminId, role: ROLE_NAMES.ADMIN },
    JWT_SECRET
  );
  const tokenSuperAdmin = jwt.sign(
    { sub: superAdminId, role: ROLE_NAMES.SUPER_ADMIN },
    JWT_SECRET
  );

  const cleanupUserIds = [userAId, userBId, adminId, superAdminId];

  before(async () => {
    // 1. Fetch role IDs
    const dbRoles = await db.select().from(roles);
    const userRole = dbRoles.find((r) => r.name === ROLE_NAMES.USER);
    const adminRole = dbRoles.find((r) => r.name === ROLE_NAMES.ADMIN);
    const superAdminRole = dbRoles.find((r) => r.name === ROLE_NAMES.SUPER_ADMIN);

    if (!userRole || !adminRole || !superAdminRole) {
      throw new Error("Missing seeded roles in database");
    }

    // 2. Insert test users
    await db.insert(users).values([
      {
        id: userAId,
        name: "User A",
        email: userAEmail,
        passwordHash: "hashA",
        roleId: userRole.id,
      },
      {
        id: userBId,
        name: "User B",
        email: userBEmail,
        passwordHash: "hashB",
        roleId: userRole.id,
      },
      {
        id: adminId,
        name: "Admin User",
        email: adminEmail,
        passwordHash: "hashAdmin",
        roleId: adminRole.id,
      },
      {
        id: superAdminId,
        name: "Super Admin",
        email: superAdminEmail,
        passwordHash: "hashSuper",
        roleId: superAdminRole.id,
      },
    ]);

    // 3. Start test HTTP server on ephemeral port
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

    // Cleanup test users (cascade deletes conversations and messages)
    if (cleanupUserIds.length > 0) {
      await db.delete(users).where(inArray(users.id, cleanupUserIds));
    }

    await pool.end();
  });

  // ==========================================================================
  // 1. Authentication & RBAC Access Control
  // ==========================================================================
  describe("Authentication & RBAC Access Control", () => {
    it("should return 401 when GET /api/conversations is called without token", async () => {
      const res = await fetch(`${baseUrl}/api/conversations`);
      assert.equal(res.status, 401);
      const data = (await res.json()) as { error: string };
      assert.ok(data.error.includes("Missing authorization header"));
    });

    it("should return 401 when GET /api/conversations/:id is called without token", async () => {
      const res = await fetch(`${baseUrl}/api/conversations/${crypto.randomUUID()}`);
      assert.equal(res.status, 401);
    });

    it("should return 401 when DELETE /api/conversations/:id is called without token", async () => {
      const res = await fetch(`${baseUrl}/api/conversations/${crypto.randomUUID()}`, {
        method: "DELETE",
      });
      assert.equal(res.status, 401);
    });

    it("should allow USER role to list conversations", async () => {
      const res = await fetch(`${baseUrl}/api/conversations`, {
        headers: { Authorization: `Bearer ${tokenUserA}` },
      });
      assert.equal(res.status, 200);
      const data = (await res.json()) as { conversations: unknown[] };
      assert.ok(Array.isArray(data.conversations));
    });

    it("should allow ADMIN role to list conversations", async () => {
      const res = await fetch(`${baseUrl}/api/conversations`, {
        headers: { Authorization: `Bearer ${tokenAdmin}` },
      });
      assert.equal(res.status, 200);
    });

    it("should allow SUPER_ADMIN role to list conversations", async () => {
      const res = await fetch(`${baseUrl}/api/conversations`, {
        headers: { Authorization: `Bearer ${tokenSuperAdmin}` },
      });
      assert.equal(res.status, 200);
    });
  });

  // ==========================================================================
  // 2. HTTP Validation & UUID Format Checking
  // ==========================================================================
  describe("UUID Format Validation", () => {
    it("should return 400 when GET /api/conversations/:id has invalid UUID", async () => {
      const res = await fetch(`${baseUrl}/api/conversations/not-a-valid-uuid`, {
        headers: { Authorization: `Bearer ${tokenUserA}` },
      });
      assert.equal(res.status, 400);
      const data = (await res.json()) as { error: string };
      assert.equal(
        data.error,
        "Invalid conversation ID format. Expected a valid UUID"
      );
    });

    it("should return 400 when DELETE /api/conversations/:id has invalid UUID", async () => {
      const res = await fetch(`${baseUrl}/api/conversations/12345-bad-id`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tokenUserA}` },
      });
      assert.equal(res.status, 400);
      const data = (await res.json()) as { error: string };
      assert.equal(
        data.error,
        "Invalid conversation ID format. Expected a valid UUID"
      );
    });
  });

  // ==========================================================================
  // 3. Listing Conversations (GET /api/conversations)
  // ==========================================================================
  describe("GET /api/conversations — User Listing & Ordering", () => {
    let convOlderId: string;
    let convNewerId: string;

    before(async () => {
      const now = Date.now();
      // Insert older conversation for User A
      const [older] = await db
        .insert(conversations)
        .values({
          userId: userAId,
          title: "User A Older Thread",
          createdAt: new Date(now - 10000),
          updatedAt: new Date(now - 10000),
        })
        .returning();
      convOlderId = older!.id;

      // Insert newer conversation for User A
      const [newer] = await db
        .insert(conversations)
        .values({
          userId: userAId,
          title: "User A Newer Thread",
          createdAt: new Date(now - 5000),
          updatedAt: new Date(now - 1000),
        })
        .returning();
      convNewerId = newer!.id;

      // Insert conversation for User B (must not be visible to User A)
      await db.insert(conversations).values({
        userId: userBId,
        title: "User B Secret Conversation",
      });
    });

    it("should return only conversations belonging to the authenticated user", async () => {
      const res = await fetch(`${baseUrl}/api/conversations`, {
        headers: { Authorization: `Bearer ${tokenUserA}` },
      });
      assert.equal(res.status, 200);
      const data = (await res.json()) as {
        conversations: Array<{ id: string; userId: string; title: string }>;
      };

      assert.ok(Array.isArray(data.conversations));
      assert.ok(data.conversations.length >= 2);

      // Verify all returned conversations belong strictly to User A
      for (const conv of data.conversations) {
        assert.equal(conv.userId, userAId);
        assert.notEqual(conv.title, "User B Secret Conversation");
      }
    });

    it("should order conversations by updatedAt descending (most recent first)", async () => {
      const res = await fetch(`${baseUrl}/api/conversations`, {
        headers: { Authorization: `Bearer ${tokenUserA}` },
      });
      assert.equal(res.status, 200);
      const data = (await res.json()) as {
        conversations: Array<{ id: string; updatedAt: string }>;
      };

      const newerIndex = data.conversations.findIndex((c) => c.id === convNewerId);
      const olderIndex = data.conversations.findIndex((c) => c.id === convOlderId);

      assert.ok(newerIndex !== -1);
      assert.ok(olderIndex !== -1);
      assert.ok(
        newerIndex < olderIndex,
        "Newer conversation must precede older conversation in list"
      );
    });
  });

  // ==========================================================================
  // 4. Get Conversation and Message Ordering (GET /api/conversations/:id)
  // ==========================================================================
  describe("GET /api/conversations/:id — Message Ordering & Detail", () => {
    let testConvId: string;

    before(async () => {
      const [conv] = await db
        .insert(conversations)
        .values({
          userId: userAId,
          title: "Detailed Thread with Messages",
        })
        .returning();
      testConvId = conv!.id;

      const baseTime = Date.now() - 50000;
      await db.insert(messages).values([
        {
          conversationId: testConvId,
          role: "user",
          content: "First Query",
          createdAt: new Date(baseTime + 1000),
        },
        {
          conversationId: testConvId,
          role: "assistant",
          content: "First Answer",
          citations: [{ filename: "doc1.pdf", pageNumber: 1 }],
          createdAt: new Date(baseTime + 2000),
        },
        {
          conversationId: testConvId,
          role: "user",
          content: "Second Query",
          createdAt: new Date(baseTime + 3000),
        },
        {
          conversationId: testConvId,
          role: "assistant",
          content: "Second Answer",
          citations: [{ filename: "doc2.pdf", pageNumber: 4 }],
          createdAt: new Date(baseTime + 4000),
        },
      ]);
    });

    it("should return conversation metadata and messages in chronological order", async () => {
      const res = await fetch(`${baseUrl}/api/conversations/${testConvId}`, {
        headers: { Authorization: `Bearer ${tokenUserA}` },
      });
      assert.equal(res.status, 200);
      const data = (await res.json()) as {
        conversation: { id: string; title: string; userId: string };
        messages: Array<{
          id: string;
          role: string;
          content: string;
          citations: unknown[];
          createdAt: string;
        }>;
      };

      assert.equal(data.conversation.id, testConvId);
      assert.equal(data.conversation.title, "Detailed Thread with Messages");
      assert.equal(data.conversation.userId, userAId);

      assert.ok(Array.isArray(data.messages));
      assert.equal(data.messages.length, 4);

      // Verify strictly chronological order (createdAt ascending)
      assert.equal(data.messages[0]?.content, "First Query");
      assert.equal(data.messages[0]?.role, "user");
      assert.equal(data.messages[1]?.content, "First Answer");
      assert.equal(data.messages[1]?.role, "assistant");
      assert.equal(data.messages[2]?.content, "Second Query");
      assert.equal(data.messages[2]?.role, "user");
      assert.equal(data.messages[3]?.content, "Second Answer");
      assert.equal(data.messages[3]?.role, "assistant");

      // Verify citations preserved
      assert.ok(Array.isArray(data.messages[1]?.citations));
      assert.equal(data.messages[1]?.citations.length, 1);
    });

    it("should return 404 when conversation ID does not exist", async () => {
      const missingId = crypto.randomUUID();
      const res = await fetch(`${baseUrl}/api/conversations/${missingId}`, {
        headers: { Authorization: `Bearer ${tokenUserA}` },
      });
      assert.equal(res.status, 404);
      const data = (await res.json()) as { error: string };
      assert.equal(data.error, "Conversation not found");
    });
  });

  // ==========================================================================
  // 5. Cross-User Access Isolation (Ownership Verification)
  // ==========================================================================
  describe("Cross-User Ownership Isolation", () => {
    let convUserAId: string;

    before(async () => {
      const [conv] = await db
        .insert(conversations)
        .values({
          userId: userAId,
          title: "User A Confidential",
        })
        .returning();
      convUserAId = conv!.id;

      await db.insert(messages).values({
        conversationId: convUserAId,
        role: "user",
        content: "Top secret content",
      });
    });

    it("should return 404 when User B attempts to read User A conversation", async () => {
      const res = await fetch(`${baseUrl}/api/conversations/${convUserAId}`, {
        headers: { Authorization: `Bearer ${tokenUserB}` },
      });
      assert.equal(res.status, 404);
      const data = (await res.json()) as { error: string };
      assert.equal(data.error, "Conversation not found");
    });

    it("should return 404 and prevent User B from deleting User A conversation", async () => {
      const res = await fetch(`${baseUrl}/api/conversations/${convUserAId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tokenUserB}` },
      });
      assert.equal(res.status, 404);
      const data = (await res.json()) as { error: string };
      assert.equal(data.error, "Conversation not found");

      // Verify User A's conversation is still alive in the database
      const [stillExists] = await db
        .select()
        .from(conversations)
        .where(eq(conversations.id, convUserAId));
      assert.ok(stillExists, "Conversation must not be deleted by unauthorized user");
    });
  });

  // ==========================================================================
  // 6. Deletion and Database Cascade (DELETE /api/conversations/:id)
  // ==========================================================================
  describe("DELETE /api/conversations/:id — Cascade Deletion", () => {
    let deleteTargetId: string;

    before(async () => {
      const [conv] = await db
        .insert(conversations)
        .values({
          userId: userAId,
          title: "Delete Me Thread",
        })
        .returning();
      deleteTargetId = conv!.id;

      // Insert messages linked to this conversation
      await db.insert(messages).values([
        {
          conversationId: deleteTargetId,
          role: "user",
          content: "Msg to cascade delete 1",
        },
        {
          conversationId: deleteTargetId,
          role: "assistant",
          content: "Msg to cascade delete 2",
        },
      ]);
    });

    it("should successfully delete conversation and cascade delete all its messages", async () => {
      const res = await fetch(`${baseUrl}/api/conversations/${deleteTargetId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tokenUserA}` },
      });

      assert.equal(res.status, 200);
      const data = (await res.json()) as { message: string; id: string };
      assert.equal(data.message, "Conversation deleted successfully");
      assert.equal(data.id, deleteTargetId);

      // Verify conversation row was deleted from database
      const [convRow] = await db
        .select()
        .from(conversations)
        .where(eq(conversations.id, deleteTargetId));
      assert.equal(convRow, undefined);

      // Verify all messages were cascade-deleted by PostgreSQL foreign key
      const msgRows = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, deleteTargetId));
      assert.equal(msgRows.length, 0);
    });

    it("should return 404 when deleting a conversation that no longer exists", async () => {
      const res = await fetch(`${baseUrl}/api/conversations/${deleteTargetId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tokenUserA}` },
      });
      assert.equal(res.status, 404);
      const data = (await res.json()) as { error: string };
      assert.equal(data.error, "Conversation not found");
    });

    it("should return 404 when deleting a non-existent random UUID", async () => {
      const res = await fetch(`${baseUrl}/api/conversations/${crypto.randomUUID()}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tokenUserA}` },
      });
      assert.equal(res.status, 404);
    });
  });
});
