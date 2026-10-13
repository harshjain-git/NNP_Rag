import type { Request, Response } from "express";
import {
  getConversations,
  getConversationWithMessages,
  deleteConversation,
} from "../services/conversation.service.js";

// Standard UUID format validator (8-4-4-4-12 hexadecimal string)
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const parseUuidParam = (param: unknown): string | null => {
  const id = (Array.isArray(param) ? param[0] : param)?.trim();
  return id && UUID_REGEX.test(id) ? id : null;
};

/**
 * Controller to list all conversations owned by the authenticated user,
 * ordered by most recently updated descending.
 *
 * Route: GET /api/conversations
 */
export const listConversationsController = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const conversations = await getConversations(userId);
    res.status(200).json({ conversations });
  } catch (error) {
    console.error("Error in listConversationsController:", error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
};

/**
 * Controller to retrieve a specific conversation and all its messages in chronological order.
 * Validates conversation existence and user ownership.
 *
 * Route: GET /api/conversations/:id
 */
export const getConversationByIdController = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const id = parseUuidParam(req.params.id);
  if (!id) {
    res.status(400).json({
      error: "Invalid conversation ID format. Expected a valid UUID",
    });
    return;
  }

  try {
    const result = await getConversationWithMessages(id, userId);
    if (!result) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    res.status(200).json({
      conversation: {
        ...result.conversation,
        messages: result.messages,
      },
      messages: result.messages,
    });
  } catch (error) {
    console.error("Error in getConversationByIdController:", error);
    res.status(500).json({ error: "Failed to fetch conversation" });
  }
};

/**
 * Controller to delete a conversation and its messages using database cascade.
 * Validates conversation existence and user ownership.
 *
 * Route: DELETE /api/conversations/:id
 */
export const deleteConversationController = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const id = parseUuidParam(req.params.id);
  if (!id) {
    res.status(400).json({
      error: "Invalid conversation ID format. Expected a valid UUID",
    });
    return;
  }

  try {
    const deleted = await deleteConversation(id, userId);
    if (!deleted) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    res.status(200).json({
      message: "Conversation deleted successfully",
      id,
    });
  } catch (error) {
    console.error("Error in deleteConversationController:", error);
    res.status(500).json({ error: "Failed to delete conversation" });
  }
};

