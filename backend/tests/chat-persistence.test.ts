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
import {
  createConversation,
  getConversationMessages,
  getRolloverContext,
  prepareConversation,
  saveExchange,
} from "../src/services/conversation.service.js";
import {
  MAX_MESSAGES_PER_CONVERSATION,
  CONVERSATION_WARNING_THRESHOLDS,
  ROLLOVER_QA_PAIRS_COUNT,
} from "../src/config/rag.js";
import { chatController } from "../src/controllers/chat.controller.js";
import type { Request, Response } from "express";

interface MockResponse {
  statusCode: number;
  body: unknown;
  res: Response;
}

const createMockResponse = (): MockResponse => {
  const mock: MockResponse = {
    statusCode: 200,
    body: null,
    res: null as unknown as Response,
  };

  mock.res = {
    status(code: number) {
      mock.statusCode = code;
      return this;
    },
    json(data: unknown) {
      mock.body = data;
      return this;
    },
  } as unknown as Response;

  return mock;
};

describe("Chat Integration & Conversational Persistence (Step 4)", () => {
  let server: http.Server;
  let baseUrl: string;

  const userAId = crypto.randomUUID();
  const userBId = crypto.randomUUID();
  const userAEmail = `user-a-${Date.now()}@test.com`;
  const userBEmail = `user-b-${Date.now()}@test.com`;

  const tokenUserA = jwt.sign(
    { sub: userAId, role: ROLE_NAMES.USER },
    JWT_SECRET
  );
  const tokenUserB = jwt.sign(
    { sub: userBId, role: ROLE_NAMES.USER },
    JWT_SECRET
  );

  const cleanupUserIds = [userAId, userBId];

  before(async () => {
    // 1. Fetch user role ID
    const [userRole] = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, ROLE_NAMES.USER))
      .limit(1);

    if (!userRole) {
      throw new Error("USER role not found in database seed");
    }

    // 2. Insert test users into database
    await db.insert(users).values([
      {
        id: userAId,
        name: "Test User A",
        email: userAEmail,
        passwordHash: "hashA",
        roleId: userRole.id,
      },
      {
        id: userBId,
        name: "Test User B",
        email: userBEmail,
        passwordHash: "hashB",
        roleId: userRole.id,
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
  // Suite 1: Successful Multi-Turn Exchanges and Message Persistence
  // ==========================================================================
  describe("1. Successful Exchanges & Multi-Turn Persistence", () => {
    let createdConvId: string;

    it("should create new conversation on first request and return conversation metadata", async () => {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenUserA}`,
        },
        body: JSON.stringify({
          query: "What is the policy summary?",
          documentId: "00000000-0000-0000-0000-000000000000",
        }),
      });

      assert.equal(res.status, 200);
      const data = (await res.json()) as {
        conversationId: string;
        remainingMessages: number;
        warning: string | null;
        isNewConversation: boolean;
        answer: string;
      };

      assert.ok(data.conversationId);
      createdConvId = data.conversationId;
      assert.equal(data.isNewConversation, true);
      assert.equal(data.remainingMessages, MAX_MESSAGES_PER_CONVERSATION - 2); // 48
      assert.equal(data.warning, null);

      // Verify conversation in DB
      const dbMsgs = await getConversationMessages(createdConvId, userAId);
      assert.ok(dbMsgs);
      assert.equal(dbMsgs.length, 2);
      assert.equal(dbMsgs[0]?.role, "user");
      assert.equal(dbMsgs[0]?.content, "What is the policy summary?");
      assert.equal(dbMsgs[1]?.role, "assistant");
    });

    it("should append exchange to existing conversation and update remaining message count", async () => {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenUserA}`,
        },
        body: JSON.stringify({
          query: "Can you elaborate on section 2?",
          conversationId: createdConvId,
          documentId: "00000000-0000-0000-0000-000000000000",
        }),
      });

      assert.equal(res.status, 200);
      const data = (await res.json()) as {
        conversationId: string;
        remainingMessages: number;
        warning: string | null;
        isNewConversation: boolean;
      };

      assert.equal(data.conversationId, createdConvId);
      assert.equal(data.isNewConversation, false);
      assert.equal(data.remainingMessages, MAX_MESSAGES_PER_CONVERSATION - 4); // 46
      assert.equal(data.warning, null);

      // Verify DB now contains 4 messages total
      const dbMsgs = await getConversationMessages(createdConvId, userAId);
      assert.ok(dbMsgs);
      assert.equal(dbMsgs.length, 4);
      assert.equal(dbMsgs[2]?.role, "user");
      assert.equal(dbMsgs[2]?.content, "Can you elaborate on section 2?");
    });

    it("should format prior messages in prepareConversation historyContext", async () => {
      const prep = await prepareConversation(
        userAId,
        "Next question",
        createdConvId
      );
      assert.equal("data" in prep, true);
      if ("data" in prep) {
        assert.equal(prep.data.isNewConversation, false);
        assert.equal(prep.data.historyContext.length, 4);
        assert.equal(prep.data.historyContext[0]?.role, "user");
        assert.equal(prep.data.historyContext[1]?.role, "assistant");
      }
    });
  });

  // ==========================================================================
  // Suite 2: Generation Failure Safety
  // ==========================================================================
  describe("2. Generation Failure Safety", () => {
    it("should not persist exchange or alter message count when generation fails", async () => {
      const conv = await createConversation(userAId, "Failure Test");
      const initialMsgs = await getConversationMessages(conv.id, userAId);
      assert.equal(initialMsgs?.length, 0);

      const mock = createMockResponse();
      const mockReq = {
        user: { id: userAId },
        body: {
          query: "This will fail",
          conversationId: conv.id,
          // documentId throwing an unexpected error
          get documentId() {
            throw new Error("Simulated LLM pipeline crash");
          },
        },
      } as unknown as Request;

      await chatController(mockReq, mock.res);

      assert.equal(mock.statusCode, 500);
      const body = mock.body as { error: string };
      assert.equal(body.error, "Failed to generate answer");

      // Verify zero messages were persisted into the conversation
      const postMsgs = await getConversationMessages(conv.id, userAId);
      assert.equal(postMsgs?.length, 0);
    });

    it("should not leave an orphaned conversation row when new conversation generation fails", async () => {
      const mock = createMockResponse();
      const mockReq = {
        user: { id: userAId },
        body: {
          query: "Orphan cleanup query",
          get documentId() {
            throw new Error("Immediate generation failure");
          },
        },
      } as unknown as Request;

      await chatController(mockReq, mock.res);

      assert.equal(mock.statusCode, 500);

      // Verify no conversation exists with that query title
      const userConvs = await db
        .select()
        .from(conversations)
        .where(eq(conversations.userId, userAId));

      const orphaned = userConvs.find((c) => c.title === "Orphan cleanup query");
      assert.equal(orphaned, undefined);
    });
  });

  // ==========================================================================
  // Suite 3: Ownership Violations
  // ==========================================================================
  describe("3. Ownership Violations", () => {
    it("should return 404 and block access when user accesses another user conversation", async () => {
      const convA = await createConversation(userAId, "User A Secret Thread");
      await saveExchange(
        convA.id,
        userAId,
        "User A query",
        "User A answer",
        []
      );

      // User B attempts to append or access User A's conversation
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenUserB}`,
        },
        body: JSON.stringify({
          query: "Intruder query",
          conversationId: convA.id,
          documentId: "00000000-0000-0000-0000-000000000000",
        }),
      });

      assert.equal(res.status, 404);
      const data = (await res.json()) as { error: string };
      assert.equal(data.error, "Conversation not found");

      // Verify User A's conversation remains untouched with only 2 messages
      const msgsA = await getConversationMessages(convA.id, userAId);
      assert.equal(msgsA?.length, 2);
    });
  });

  // ==========================================================================
  // Suite 4: Warning Thresholds (at 8 and 5 remaining messages)
  // ==========================================================================
  describe("4. Warning Thresholds (8 and 5 remaining)", () => {
    it("should trigger warning when remaining messages count reaches 8", async () => {
      const conv = await createConversation(userAId, "Warning 8 Threshold");

      // Seed 40 messages (20 exchanges)
      const values = [];
      for (let i = 0; i < 20; i++) {
        values.push(
          { conversationId: conv.id, role: "user", content: `Seed Q${i}` },
          { conversationId: conv.id, role: "assistant", content: `Seed A${i}` }
        );
      }
      await db.insert(messages).values(values);

      // Exchange adds 2 messages: 40 + 2 = 42 total -> remaining = 50 - 42 = 8
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenUserA}`,
        },
        body: JSON.stringify({
          query: "Trigger 8 warning",
          conversationId: conv.id,
          documentId: "00000000-0000-0000-0000-000000000000",
        }),
      });

      assert.equal(res.status, 200);
      const data = (await res.json()) as {
        remainingMessages: number;
        warning: string | null;
      };

      assert.equal(data.remainingMessages, 8);
      assert.equal(
        data.warning,
        `${CONVERSATION_WARNING_THRESHOLDS[0]} messages remaining in this conversation`
      );
    });

    it("should trigger warning when remaining messages count reaches 5", async () => {
      const conv = await createConversation(userAId, "Warning 5 Threshold");

      // Seed 43 messages (odd number so 43 + 2 = 45 -> remaining = 5)
      const values = [];
      for (let i = 0; i < 21; i++) {
        values.push(
          { conversationId: conv.id, role: "user", content: `Seed Q${i}` },
          { conversationId: conv.id, role: "assistant", content: `Seed A${i}` }
        );
      }
      values.push({
        conversationId: conv.id,
        role: "user",
        content: "Single extra message",
      });
      await db.insert(messages).values(values);

      // Exchange adds 2 messages: 43 + 2 = 45 total -> remaining = 50 - 45 = 5
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenUserA}`,
        },
        body: JSON.stringify({
          query: "Trigger 5 warning",
          conversationId: conv.id,
          documentId: "00000000-0000-0000-0000-000000000000",
        }),
      });

      assert.equal(res.status, 200);
      const data = (await res.json()) as {
        remainingMessages: number;
        warning: string | null;
      };

      assert.equal(data.remainingMessages, 5);
      assert.equal(
        data.warning,
        `${CONVERSATION_WARNING_THRESHOLDS[1]} messages remaining in this conversation`
      );
    });

    it("should return null warning when not at threshold (e.g. 10 remaining)", async () => {
      const conv = await createConversation(userAId, "No Warning Thread");

      // Seed 38 messages -> 38 + 2 = 40 -> remaining = 10
      const values = [];
      for (let i = 0; i < 19; i++) {
        values.push(
          { conversationId: conv.id, role: "user", content: `Seed Q${i}` },
          { conversationId: conv.id, role: "assistant", content: `Seed A${i}` }
        );
      }
      await db.insert(messages).values(values);

      const res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenUserA}`,
        },
        body: JSON.stringify({
          query: "Query at 10 remaining",
          conversationId: conv.id,
          documentId: "00000000-0000-0000-0000-000000000000",
        }),
      });

      assert.equal(res.status, 200);
      const data = (await res.json()) as {
        remainingMessages: number;
        warning: string | null;
      };

      assert.equal(data.remainingMessages, 10);
      assert.equal(data.warning, null);
    });
  });

  // ==========================================================================
  // Suite 5: Rollover Behavior at 50-Message Limit
  // ==========================================================================
  describe("5. Rollover Behavior at 50-Message Limit", () => {
    it("should automatically rollover to new conversation when 50 limit is reached", async () => {
      const fullConv = await createConversation(userAId, "Maxed Out Thread");

      // Seed exactly 50 messages (25 complete Q&A pairs) with monotonic timestamps
      const baseTime = Date.now() - 200000;
      const values = [];
      for (let i = 1; i <= 25; i++) {
        values.push(
          {
            conversationId: fullConv.id,
            role: "user",
            content: `Question ${i}`,
            createdAt: new Date(baseTime + (i * 2 - 1) * 1000),
          },
          {
            conversationId: fullConv.id,
            role: "assistant",
            content: `Answer ${i}`,
            createdAt: new Date(baseTime + (i * 2) * 1000),
          }
        );
      }
      await db.insert(messages).values(values);

      // Verify seed count
      const seedMsgs = await getConversationMessages(fullConv.id, userAId);
      assert.equal(seedMsgs?.length, 50);

      // Verify getRolloverContext retrieves the latest 8 complete pairs (16 messages)
      const rolloverContext = await getRolloverContext(fullConv.id, userAId);
      assert.ok(rolloverContext);
      assert.equal(rolloverContext.length, ROLLOVER_QA_PAIRS_COUNT * 2); // 16
      assert.equal(rolloverContext[0]?.content, "Question 18");
      assert.equal(rolloverContext[rolloverContext.length - 1]?.content, "Answer 25");

      // Request chat on the full conversation -> triggers rollover
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenUserA}`,
        },
        body: JSON.stringify({
          query: "Rollover query 26",
          conversationId: fullConv.id,
          documentId: "00000000-0000-0000-0000-000000000000",
        }),
      });

      assert.equal(res.status, 200);
      const data = (await res.json()) as {
        conversationId: string;
        isNewConversation: boolean;
        remainingMessages: number;
      };

      // Rollover produces a NEW conversation ID
      assert.notEqual(data.conversationId, fullConv.id);
      assert.equal(data.isNewConversation, true);
      assert.equal(data.remainingMessages, MAX_MESSAGES_PER_CONVERSATION - 2); // 48

      // Original conversation must remain untouched with 50 messages
      const oldMsgs = await getConversationMessages(fullConv.id, userAId);
      assert.equal(oldMsgs?.length, 50);

      // New conversation must contain ONLY the new exchange (2 messages; not old messages copied)
      const newMsgs = await getConversationMessages(data.conversationId, userAId);
      assert.ok(newMsgs);
      assert.equal(newMsgs.length, 2);
      assert.equal(newMsgs[0]?.role, "user");
      assert.equal(newMsgs[0]?.content, "Rollover query 26");
    });
  });

  // ==========================================================================
  // Suite 6: Concurrency Safeguards
  // ==========================================================================
  describe("6. Concurrency Safeguards", () => {
    it("should safely handle concurrent requests at the limit boundary without exceeding 50", async () => {
      const conv = await createConversation(userAId, "Concurrency Boundary");

      // Seed 48 messages (only 1 exchange capacity remaining before hitting 50)
      const values = [];
      for (let i = 1; i <= 24; i++) {
        values.push(
          { conversationId: conv.id, role: "user", content: `Concurrent Seed Q${i}` },
          { conversationId: conv.id, role: "assistant", content: `Concurrent Seed A${i}` }
        );
      }
      await db.insert(messages).values(values);

      // Launch 2 concurrent requests
      const [res1, res2] = await Promise.all([
        fetch(`${baseUrl}/api/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokenUserA}`,
          },
          body: JSON.stringify({
            query: "Concurrent Request Alpha",
            conversationId: conv.id,
            documentId: "00000000-0000-0000-0000-000000000000",
          }),
        }),
        fetch(`${baseUrl}/api/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokenUserA}`,
          },
          body: JSON.stringify({
            query: "Concurrent Request Beta",
            conversationId: conv.id,
            documentId: "00000000-0000-0000-0000-000000000000",
          }),
        }),
      ]);

      assert.equal(res1.status, 200);
      assert.equal(res2.status, 200);

      const data1 = (await res1.json()) as {
        conversationId: string;
        isNewConversation: boolean;
        remainingMessages: number;
      };
      const data2 = (await res2.json()) as {
        conversationId: string;
        isNewConversation: boolean;
        remainingMessages: number;
      };

      // Exactly one request claims the remaining slot in conv (remaining 0, isNewConversation false)
      // The other request detects limitExceeded in saveExchange and rolls over to a new conv
      const claimedSlot = [data1, data2].find((d) => d.conversationId === conv.id);
      const rolledOver = [data1, data2].find((d) => d.conversationId !== conv.id);

      assert.ok(claimedSlot, "One request must claim the final slot in original conversation");
      assert.equal(claimedSlot.isNewConversation, false);
      assert.equal(claimedSlot.remainingMessages, 0);

      assert.ok(rolledOver, "The second concurrent request must rollover to a new conversation");
      assert.equal(rolledOver.isNewConversation, true);
      assert.equal(rolledOver.remainingMessages, MAX_MESSAGES_PER_CONVERSATION - 2);

      // Verify the original conversation NEVER exceeds 50 messages in the database
      const finalOriginalMsgs = await getConversationMessages(conv.id, userAId);
      assert.equal(finalOriginalMsgs?.length, 50);

      // Verify the rolled-over conversation has exactly 2 messages
      const rolledOverMsgs = await getConversationMessages(
        rolledOver.conversationId,
        userAId
      );
      assert.equal(rolledOverMsgs?.length, 2);
    });
  });
});
