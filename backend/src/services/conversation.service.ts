import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "../database/client.js";
import {
  conversations,
  messages,
  type Conversation,
  type Message,
} from "../database/schema.js";
import {
  MAX_MESSAGES_PER_CONVERSATION,
  CONVERSATION_WARNING_THRESHOLDS,
  ROLLOVER_QA_PAIRS_COUNT,
  CONVERSATION_TITLE_MAX_LENGTH,
} from "../config/rag.js";

export {
  MAX_MESSAGES_PER_CONVERSATION,
  CONVERSATION_WARNING_THRESHOLDS,
  ROLLOVER_QA_PAIRS_COUNT,
  CONVERSATION_TITLE_MAX_LENGTH,
} from "../config/rag.js";

export type SaveExchangeResult =
  | {
      success: true;
      userMessage: Message;
      assistantMessage: Message;
      remainingMessages: number;
      warning: string | null;
    }
  | { error: "notFound" }
  | { error: "limitExceeded"; currentCount: number };

export interface PrepareConversationResult {
  conversationId: string;
  isNewConversation: boolean;
  historyContext: Array<{ role: string; content: string }>;
}

export const getConversations = async (
  userId: string
): Promise<Conversation[]> =>
  db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt));

export const getConversationById = async (
  conversationId: string,
  userId: string
): Promise<Conversation | null> => {
  const [conv] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .limit(1);
  return conv ?? null;
};

export const getConversationWithMessages = async (
  conversationId: string,
  userId: string
): Promise<{ conversation: Conversation; messages: Message[] } | null> => {
  const conv = await getConversationById(conversationId, userId);
  if (!conv) return null;

  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt));

  return { conversation: conv, messages: msgs };
};

export const getConversationMessages = async (
  conversationId: string,
  userId: string
): Promise<Message[] | null> => {
  const result = await getConversationWithMessages(conversationId, userId);
  return result?.messages ?? null;
};

export const createConversation = async (
  userId: string,
  title: string
): Promise<Conversation> => {
  const [created] = await db
    .insert(conversations)
    .values({ userId, title: title.trim() || "New Conversation" })
    .returning();
  return created!;
};

export const deleteConversation = async (
  conversationId: string,
  userId: string
): Promise<boolean> => {
  const [deleted] = await db
    .delete(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .returning({ id: conversations.id });
  return Boolean(deleted);
};

export const getRolloverContext = async (
  conversationId: string,
  userId: string
): Promise<Array<{ role: string; content: string }> | null> => {
  const msgs = await getConversationMessages(conversationId, userId);
  if (!msgs) return null;

  return msgs
    .slice(-ROLLOVER_QA_PAIRS_COUNT * 2)
    .map((m) => ({ role: m.role, content: m.content }));
};

export const prepareConversation = async (
  userId: string,
  query: string,
  requestedConversationId?: string
): Promise<
  | { success: true; data: PrepareConversationResult }
  | { error: "notFound" }
> => {
  const title = query.slice(0, CONVERSATION_TITLE_MAX_LENGTH);

  if (requestedConversationId) {
    const data = await getConversationWithMessages(requestedConversationId, userId);
    if (!data) return { error: "notFound" };

    const recentHistory = data.messages
      .slice(-ROLLOVER_QA_PAIRS_COUNT * 2)
      .map((m) => ({ role: m.role, content: m.content }));

    if (data.messages.length + 2 > MAX_MESSAGES_PER_CONVERSATION) {
      const newConv = await createConversation(userId, title);
      return {
        success: true,
        data: {
          conversationId: newConv.id,
          isNewConversation: true,
          historyContext: recentHistory,
        },
      };
    }

    return {
      success: true,
      data: {
        conversationId: requestedConversationId,
        isNewConversation: false,
        historyContext: recentHistory,
      },
    };
  }

  const newConv = await createConversation(userId, title);
  return {
    success: true,
    data: {
      conversationId: newConv.id,
      isNewConversation: true,
      historyContext: [],
    },
  };
};

export const saveExchange = async (
  conversationId: string,
  userId: string,
  userQuery: string,
  assistantAnswer: string,
  citations: unknown[] = []
): Promise<SaveExchangeResult> => {
  return db.transaction(async (tx) => {
    // 1. Lock conversation row in PostgreSQL to serialize concurrent requests
    const [conv] = await tx
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
      .for("update");

    if (!conv) return { error: "notFound" };

    // 2. Count existing messages for this conversation inside the locked transaction
    const [countRow] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(eq(messages.conversationId, conversationId));

    const currentCount = countRow?.count ?? 0;

    // 3. Strict 50-message limit enforcement: an exchange adds 2 messages
    if (currentCount + 2 > MAX_MESSAGES_PER_CONVERSATION) {
      return { error: "limitExceeded", currentCount };
    }

    // 4. Atomically insert user and assistant messages in a single query
    const [userMsg, assistantMsg] = await tx
      .insert(messages)
      .values([
        { conversationId, role: "user", content: userQuery },
        { conversationId, role: "assistant", content: assistantAnswer, citations },
      ])
      .returning();

    // 5. Update conversation timestamp
    await tx
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));

    // 6. Calculate remaining messages post-exchange and evaluate warning triggers
    const remainingMessages = MAX_MESSAGES_PER_CONVERSATION - (currentCount + 2);
    const [warn8, warn5] = CONVERSATION_WARNING_THRESHOLDS;
    const warning =
      remainingMessages === warn8 || remainingMessages === warn5
        ? `${remainingMessages} messages remaining in this conversation`
        : null;

    return {
      success: true,
      userMessage: userMsg!,
      assistantMessage: assistantMsg!,
      remainingMessages,
      warning,
    };
  });
};
