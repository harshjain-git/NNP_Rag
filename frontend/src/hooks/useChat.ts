"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  sendChatQuery,
  streamChatQuery,
  closeChatSocket,
  type ActiveChatStream,
} from "@/lib/api/chat";
import { getConversationById } from "@/lib/api/conversations";
import type { Message, ChatRequest, ChatResponse } from "@/types";

export interface UseChatOptions {
  token: string | null;
  onNewConversationCreated?: () => void;
}

export interface UseChatReturn {
  messages: Message[];
  activeConversationId: string | null;
  isGenerating: boolean;
  isLoadingConversation: boolean;
  error: string | null;
  warning: string | null;
  sendMessage: (query: string) => Promise<boolean>;
  loadConversation: (id: string) => Promise<void>;
  startNewChat: () => void;
  clearError: () => void;
  stopGenerating: () => void;
}

export function useChat({ token, onNewConversationCreated }: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const activeStreamRef = useRef<ActiveChatStream | null>(null);
  const activeConversationIdRef = useRef<string | null>(null);
  const onNewConversationCreatedRef = useRef(onNewConversationCreated);
  const activeLoadIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    onNewConversationCreatedRef.current = onNewConversationCreated;
  }, [onNewConversationCreated]);

  // Synchronize state during render when token changes
  const [prevToken, setPrevToken] = useState(token);
  if (token !== prevToken) {
    setPrevToken(token);
    if (!token) {
      setMessages([]);
      setActiveConversationId(null);
      setIsGenerating(false);
      setIsLoadingConversation(false);
      setError(null);
      setWarning(null);
    }
  }

  // Handle socket cleanup on token changes
  useEffect(() => {
    if (!token) {
      closeChatSocket();
    }
  }, [token]);

  // Cleanup active stream on unmount
  useEffect(() => {
    return () => {
      activeStreamRef.current?.close();
      activeStreamRef.current = null;
    };
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const stopGenerating = useCallback(() => {
    if (activeStreamRef.current) {
      activeStreamRef.current.cancel();
      activeStreamRef.current = null;
    }
    setIsGenerating(false);
  }, []);

  const startNewChat = useCallback(() => {
    stopGenerating();
    activeLoadIdRef.current = null;
    setActiveConversationId(null);
    setMessages([]);
    setError(null);
    setWarning(null);
    setIsGenerating(false);
    setIsLoadingConversation(false);
  }, [stopGenerating]);

  const loadConversation = useCallback(
    async (id: string): Promise<void> => {
      if (!token || !id) return;

      activeLoadIdRef.current = id;
      setIsLoadingConversation(true);
      setError(null);

      try {
        const res = await getConversationById(id, token);
        if (activeLoadIdRef.current === id) {
          const loadedMessages = res.messages || res.conversation?.messages || [];
          setMessages(loadedMessages);
          setActiveConversationId(id);
        }
      } catch (err) {
        if (activeLoadIdRef.current === id) {
          const msg =
            err instanceof Error ? err.message : "Failed to load conversation messages";
          setError(msg);
        }
      } finally {
        if (activeLoadIdRef.current === id) {
          setIsLoadingConversation(false);
        }
      }
    },
    [token]
  );

  const sendMessage = useCallback(
    async (query: string): Promise<boolean> => {
      const trimmed = query.trim();
      if (!trimmed || isGenerating) return false;

      setError(null);
      setWarning(null);
      setIsGenerating(true);

      const targetConversationId = activeConversationId;
      const requestId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      const userMessage: Message = {
        id: `user-${Date.now()}`,
        conversationId: targetConversationId || "",
        role: "user",
        content: trimmed,
        citations: null,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);

      try {
        const stream = await streamChatQuery(
          trimmed,
          {
            token,
            conversationId: targetConversationId || undefined,
            requestId,
          },
          {
            onStart: (payload) => {
              if (payload.conversationId) {
                setActiveConversationId(payload.conversationId);
                activeConversationIdRef.current = payload.conversationId;
              }
            },
            onToken: (chunk) => {
              setMessages((prev) => {
                const assistantId = `assistant-${requestId}`;
                const idx = prev.findIndex((m) => m.id === assistantId);
                if (idx !== -1) {
                  const updated = [...prev];
                  const existing = updated[idx]!;
                  updated[idx] = { ...existing, content: existing.content + chunk };
                  return updated;
                }
                return [
                  ...prev,
                  {
                    id: assistantId,
                    conversationId: activeConversationIdRef.current || "",
                    role: "assistant",
                    content: chunk,
                    citations: null,
                    createdAt: new Date().toISOString(),
                  },
                ];
              });
            },
            onComplete: (payload) => {
              const completedMessage: Message = {
                id: `assistant-${requestId}`,
                conversationId: payload.conversationId,
                role: "assistant",
                content: payload.answer,
                citations: payload.citations || [],
                createdAt: new Date().toISOString(),
              };

              setMessages((prev) => {
                const assistantId = `assistant-${requestId}`;
                const idx = prev.findIndex((m) => m.id === assistantId);
                if (idx !== -1) {
                  const updated = [...prev];
                  updated[idx] = completedMessage;
                  return updated;
                }
                return [...prev, completedMessage];
              });

              if (payload.conversationId && payload.conversationId !== activeConversationIdRef.current) {
                setActiveConversationId(payload.conversationId);
                activeConversationIdRef.current = payload.conversationId;
              }
              if (payload.warning) setWarning(payload.warning);
              if (payload.isNewConversation) onNewConversationCreatedRef.current?.();

              setIsGenerating(false);
              activeStreamRef.current = null;
            },
            onError: (errMsg) => {
              setMessages((prev) => prev.filter((m) => m.id !== `assistant-${requestId}`));
              setError(errMsg);
              setIsGenerating(false);
              activeStreamRef.current = null;
            },
          }
        );

        activeStreamRef.current = stream;
        return true;
      } catch {
        // Seamless fallback to REST
        try {
          const payload: ChatRequest = {
            query: trimmed,
            ...(targetConversationId ? { conversationId: targetConversationId } : {}),
          };
          const res: ChatResponse = await sendChatQuery(payload, token);

          const newConvId = res.conversationId || targetConversationId || "";
          const assistantMessage: Message = {
            id: `assistant-${requestId}`,
            conversationId: newConvId,
            role: "assistant",
            content: res.answer,
            citations: res.citations || [],
            createdAt: new Date().toISOString(),
          };

          setMessages((prev) => [...prev, assistantMessage]);

          if (res.conversationId && res.conversationId !== targetConversationId) {
            setActiveConversationId(res.conversationId);
          }
          if (res.warning) setWarning(res.warning);
          if (res.isNewConversation) onNewConversationCreatedRef.current?.();
          return true;
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Failed to generate answer";
          setError(msg);
          return false;
        } finally {
          setIsGenerating(false);
          activeStreamRef.current = null;
        }
      }
    },
    [token, activeConversationId, isGenerating]
  );

  return {
    messages,
    activeConversationId,
    isGenerating,
    isLoadingConversation,
    error,
    warning,
    sendMessage,
    loadConversation,
    startNewChat,
    clearError,
    stopGenerating,
  };
}
