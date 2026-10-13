import type { Request, Response } from "express";
import {
  listPrompts,
  getPromptById,
  getActivePrompt,
  createPrompt,
  updatePrompt,
  deletePrompt,
} from "../services/prompts.service.js";
import {
  PROMPT_TYPES,
  PROMPT_STATUSES,
  type PromptType,
  type PromptStatus,
} from "../database/schema.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_TYPES = new Set<string>(Object.values(PROMPT_TYPES));
const VALID_STATUSES = new Set<string>(Object.values(PROMPT_STATUSES));

const parseUuid = (val: unknown): string | null =>
  typeof val === "string" && UUID_REGEX.test(val.trim()) ? val.trim() : null;

export const createPromptController = async (req: Request, res: Response): Promise<void> => {
  const { name, content, type, status } = req.body ?? {};

  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "Prompt name is required" });
    return;
  }
  if (!content || typeof content !== "string" || !content.trim()) {
    res.status(400).json({ error: "Prompt content is required" });
    return;
  }
  if (type && (!VALID_TYPES.has(type) || typeof type !== "string")) {
    res.status(400).json({ error: `Invalid prompt type. Allowed: ${[...VALID_TYPES].join(", ")}` });
    return;
  }
  if (status && (!VALID_STATUSES.has(status) || typeof status !== "string")) {
    res.status(400).json({ error: `Invalid prompt status. Allowed: ${[...VALID_STATUSES].join(", ")}` });
    return;
  }

  try {
    const result = await createPrompt({
      name,
      content,
      type: type as PromptType,
      status: status as PromptStatus,
      createdBy: parseUuid(req.user?.id) ?? undefined,
    });

    if (result.error === "conflict") {
      res.status(409).json({ error: "Prompt name already exists" });
      return;
    }
    res.status(201).json({ message: "Prompt created successfully", prompt: result.prompt });
  } catch (error) {
    console.error("Error creating prompt:", error);
    res.status(500).json({ error: "Failed to create prompt" });
  }
};

export const listPromptsController = async (req: Request, res: Response): Promise<void> => {
  const { type, status } = req.query;
  if (type && (!VALID_TYPES.has(type as string) || typeof type !== "string")) {
    res.status(400).json({ error: `Invalid type filter. Allowed: ${[...VALID_TYPES].join(", ")}` });
    return;
  }
  if (status && (!VALID_STATUSES.has(status as string) || typeof status !== "string")) {
    res.status(400).json({ error: `Invalid status filter. Allowed: ${[...VALID_STATUSES].join(", ")}` });
    return;
  }

  try {
    const prompts = await listPrompts({
      type: type as PromptType,
      status: status as PromptStatus,
    });
    res.status(200).json({ prompts });
  } catch (error) {
    console.error("Error listing prompts:", error);
    res.status(500).json({ error: "Failed to fetch prompts" });
  }
};

export const getActivePromptController = async (req: Request, res: Response): Promise<void> => {
  const rawType = req.params.type;
  const type = Array.isArray(rawType) ? rawType[0] : rawType;
  if (!type || !VALID_TYPES.has(type)) {
    res.status(400).json({ error: `Invalid prompt type. Allowed: ${[...VALID_TYPES].join(", ")}` });
    return;
  }

  try {
    const prompt = await getActivePrompt(type as PromptType);
    if (!prompt) {
      res.status(404).json({ error: "No active prompt found" });
      return;
    }
    res.status(200).json({ prompt });
  } catch (error) {
    console.error("Error fetching active prompt:", error);
    res.status(500).json({ error: "Failed to fetch active prompt" });
  }
};

export const getPromptByIdController = async (req: Request, res: Response): Promise<void> => {
  const id = parseUuid(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid prompt ID format. Expected a valid UUID" });
    return;
  }

  try {
    const prompt = await getPromptById(id);
    if (!prompt) {
      res.status(404).json({ error: "Prompt not found" });
      return;
    }
    res.status(200).json({ prompt });
  } catch (error) {
    console.error("Error fetching prompt:", error);
    res.status(500).json({ error: "Failed to fetch prompt" });
  }
};

export const updatePromptController = async (req: Request, res: Response): Promise<void> => {
  const id = parseUuid(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid prompt ID format. Expected a valid UUID" });
    return;
  }

  const { name, content, type, status } = req.body ?? {};
  if (name === undefined && content === undefined && type === undefined && status === undefined) {
    res.status(400).json({ error: "At least one field to update is required" });
    return;
  }
  if (name !== undefined && (typeof name !== "string" || !name.trim())) {
    res.status(400).json({ error: "Name cannot be empty" });
    return;
  }
  if (content !== undefined && (typeof content !== "string" || !content.trim())) {
    res.status(400).json({ error: "Content cannot be empty" });
    return;
  }
  if (type !== undefined && (typeof type !== "string" || !VALID_TYPES.has(type))) {
    res.status(400).json({ error: `Invalid prompt type. Allowed: ${[...VALID_TYPES].join(", ")}` });
    return;
  }
  if (status !== undefined && (typeof status !== "string" || !VALID_STATUSES.has(status))) {
    res.status(400).json({ error: `Invalid prompt status. Allowed: ${[...VALID_STATUSES].join(", ")}` });
    return;
  }

  try {
    const result = await updatePrompt(id, { name, content, type, status });
    if (result.error === "notFound") {
      res.status(404).json({ error: "Prompt not found" });
      return;
    }
    if (result.error === "conflict") {
      res.status(409).json({ error: "Prompt name already exists" });
      return;
    }
    res.status(200).json({ message: "Prompt updated successfully", prompt: result.prompt });
  } catch (error) {
    console.error("Error updating prompt:", error);
    res.status(500).json({ error: "Failed to update prompt" });
  }
};

export const deletePromptController = async (req: Request, res: Response): Promise<void> => {
  const id = parseUuid(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid prompt ID format. Expected a valid UUID" });
    return;
  }

  try {
    const deleted = await deletePrompt(id);
    if (!deleted) {
      res.status(404).json({ error: "Prompt not found" });
      return;
    }
    res.status(200).json({ message: "Prompt deleted successfully", id });
  } catch (error) {
    console.error("Error deleting prompt:", error);
    res.status(500).json({ error: "Failed to delete prompt" });
  }
};
