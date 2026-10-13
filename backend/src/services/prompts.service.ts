import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "../database/client.js";
import {
  prompts,
  PROMPT_TYPES,
  PROMPT_STATUSES,
  type Prompt,
  type PromptType,
  type PromptStatus,
} from "../database/schema.js";

export const listPrompts = async (filters?: {
  type?: PromptType;
  status?: PromptStatus;
}): Promise<Prompt[]> => {
  const conditions = [];
  if (filters?.type) conditions.push(eq(prompts.type, filters.type));
  if (filters?.status) conditions.push(eq(prompts.status, filters.status));

  return db
    .select()
    .from(prompts)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(prompts.updatedAt), desc(prompts.createdAt));
};

export const getPromptById = async (id: string): Promise<Prompt | null> => {
  const [prompt] = await db.select().from(prompts).where(eq(prompts.id, id)).limit(1);
  return prompt ?? null;
};

export const getActivePrompt = async (type: PromptType): Promise<Prompt | null> => {
  const [prompt] = await db
    .select()
    .from(prompts)
    .where(and(eq(prompts.type, type), eq(prompts.status, PROMPT_STATUSES.ACTIVE)))
    .orderBy(desc(prompts.updatedAt), desc(prompts.createdAt))
    .limit(1);
  return prompt ?? null;
};

export const createPrompt = async (data: {
  name: string;
  content: string;
  type?: PromptType | undefined;
  status?: PromptStatus | undefined;
  createdBy?: string | undefined;
}): Promise<{ prompt?: Prompt; error?: "conflict" }> => {
  const name = data.name.trim();
  const [existing] = await db.select({ id: prompts.id }).from(prompts).where(eq(prompts.name, name)).limit(1);
  if (existing) return { error: "conflict" };

  const [prompt] = await db
    .insert(prompts)
    .values({
      name,
      content: data.content.trim(),
      type: data.type ?? PROMPT_TYPES.SYSTEM,
      status: data.status ?? PROMPT_STATUSES.ACTIVE,
      createdBy: data.createdBy,
    })
    .returning();

  return { prompt: prompt! };
};

export const updatePrompt = async (
  id: string,
  data: { name?: string; content?: string; type?: PromptType; status?: PromptStatus }
): Promise<{ prompt?: Prompt; error?: "notFound" | "conflict" }> => {
  const current = await getPromptById(id);
  if (!current) return { error: "notFound" };

  const name = data.name?.trim();
  if (name && name !== current.name) {
    const [conflict] = await db
      .select({ id: prompts.id })
      .from(prompts)
      .where(and(eq(prompts.name, name), ne(prompts.id, id)))
      .limit(1);
    if (conflict) return { error: "conflict" };
  }

  const [updated] = await db
    .update(prompts)
    .set({
      ...(name && { name }),
      ...(data.content && { content: data.content.trim() }),
      ...(data.type && { type: data.type }),
      ...(data.status && { status: data.status }),
      updatedAt: new Date(),
    })
    .where(eq(prompts.id, id))
    .returning();

  return { prompt: updated! };
};

export const deletePrompt = async (id: string): Promise<boolean> => {
  const [deleted] = await db.delete(prompts).where(eq(prompts.id, id)).returning({ id: prompts.id });
  return Boolean(deleted);
};

export const promptsService = {
  listPrompts,
  getPromptById,
  getActivePrompt,
  createPrompt,
  updatePrompt,
  deletePrompt,
};

