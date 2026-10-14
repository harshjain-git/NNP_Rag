"use client";

import { useState, useEffect, useCallback } from "react";
import { getConversations, deleteConversation } from "@/lib/api/conversations";
import type { Conversation } from "@/types";

export interface UseConversationsReturn {
  conversations: Conversation[];
  isLoading: boolean;
  error: string | null;
  refreshConversations: () => Promise<void>;
  deleteConversationById: (id: string) => Promise<boolean>;
}

export function useConversations(token: string | null): UseConversationsReturn {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(token));
  const [error, setError] = useState<string | null>(null);

  // Sync state during render when token changes (React recommended pattern)
  const [prevToken, setPrevToken] = useState(token);
  if (token !== prevToken) {
    setPrevToken(token);
    if (!token) {
      setConversations([]);
      setIsLoading(false);
      setError(null);
    } else {
      setIsLoading(true);
      setError(null);
    }
  }

  const refreshConversations = useCallback(async (): Promise<void> => {
    if (!token) {
      setConversations([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await getConversations(token);
      setConversations(res.conversations || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load conversations";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const deleteConversationById = useCallback(
    async (id: string): Promise<boolean> => {
      if (!token) return false;

      try {
        await deleteConversation(id, token);
        setConversations((prev) => prev.filter((conv) => conv.id !== id));
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to delete conversation";
        setError(msg);
        return false;
      }
    },
    [token]
  );

  useEffect(() => {
    let isMounted = true;

    if (!token) return;

    getConversations(token)
      .then((res) => {
        if (isMounted) {
          setConversations(res.conversations || []);
        }
      })
      .catch((err) => {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : "Failed to load conversations";
          setError(msg);
          setConversations([]);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  return {
    conversations,
    isLoading,
    error,
    refreshConversations,
    deleteConversationById,
  };
}
