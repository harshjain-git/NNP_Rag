"use client";

import { useState, useEffect, useCallback } from "react";
import { getPrompts, createPrompt, updatePrompt, deletePrompt } from "@/lib/api/prompts";
import type { Prompt, CreatePromptPayload, UpdatePromptPayload } from "@/types";

export function usePrompts(token: string | null) {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(token));
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sync state during render when token changes
  const [prevToken, setPrevToken] = useState(token);
  if (token !== prevToken) {
    setPrevToken(token);
    if (!token) {
      setPrompts([]);
      setIsLoading(false);
      setError(null);
    } else {
      setIsLoading(true);
      setError(null);
    }
  }

  const refresh = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await getPrompts(undefined, token);
      setPrompts(res.prompts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load prompts");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    let isMounted = true;
    if (!token) return;

    getPrompts(undefined, token)
      .then((res) => {
        if (isMounted) setPrompts(res.prompts || []);
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load prompts");
          setPrompts([]);
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const create = async (payload: CreatePromptPayload): Promise<boolean> => {
    if (!token) return false;
    setError(null);
    try {
      const res = await createPrompt(payload, token);
      setPrompts((prev) => [res.prompt, ...prev]);
      setSuccessMessage(res.message || "Prompt created successfully.");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create prompt");
      return false;
    }
  };

  const update = async (id: string, payload: UpdatePromptPayload): Promise<boolean> => {
    if (!token) return false;
    setError(null);
    try {
      const res = await updatePrompt(id, payload, token);
      setPrompts((prev) => prev.map((p) => (p.id === id ? res.prompt : p)));
      setSuccessMessage(res.message || "Prompt updated successfully.");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update prompt");
      return false;
    }
  };

  const toggleStatus = (prompt: Prompt) =>
    update(prompt.id, { status: prompt.status === "active" ? "draft" : "active" });

  const remove = async (id: string): Promise<boolean> => {
    if (!token) return false;
    setError(null);
    try {
      const res = await deletePrompt(id, token);
      setPrompts((prev) => prev.filter((p) => p.id !== id));
      setSuccessMessage(res.message || "Prompt deleted successfully.");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete prompt");
      return false;
    }
  };

  return {
    prompts,
    isLoading,
    error,
    successMessage,
    refresh,
    create,
    update,
    toggleStatus,
    remove,
    clearFeedback: () => {
      setError(null);
      setSuccessMessage(null);
    },
  };
}
