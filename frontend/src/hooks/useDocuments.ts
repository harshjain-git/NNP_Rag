"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getDocuments, uploadDocuments, deleteDocument } from "@/lib/api/documents";
import { getWsUrl } from "@/lib/api/chat";
import type { DocumentItem, IngestionEventType, SkippedDocument } from "@/types";

export function useDocuments(token: string | null) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(token));
  const [error, setError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<SkippedDocument[]>([]);
  const reconcileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch initial documents list
  useEffect(() => {
    if (!token) return;

    let active = true;
    getDocuments(token)
      .then((res) => {
        if (active) setDocuments(res.documents || []);
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load documents");
          setDocuments([]);
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  // Imperative manual refresh
  const refresh = useCallback(async (): Promise<void> => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await getDocuments(token);
      setDocuments(res.documents || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  // Connect to WebSocket /ws with reconnection & ingestion lifecycle tracking
  useEffect(() => {
    if (!token || typeof window === "undefined") return;

    let isUnmounted = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (isUnmounted || !token) return;

      try {
        ws = new WebSocket(getWsUrl(token));

        ws.onopen = () => {
          // Send handshake auth event to authenticate socket session
          ws?.send(JSON.stringify({ type: "auth", payload: { token } }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (!data || typeof data !== "object") return;

            const type = data.type as IngestionEventType;
            const payload = data.payload;
            const documentId = payload?.documentId;
            if (!documentId) return;

            setDocuments((prev) =>
              prev.map((doc) => {
                if (doc.id !== documentId) return doc;

                switch (type) {
                  case "document.processing":
                    return { ...doc, status: "processing", stage: "processing" };
                  case "document.parsing":
                    return { ...doc, status: "processing", stage: "parsing" };
                  case "document.chunking":
                    return {
                      ...doc,
                      status: "processing",
                      stage: "chunking",
                      totalPages: payload.totalPages ?? doc.totalPages,
                    };
                  case "document.embedding":
                    return {
                      ...doc,
                      status: "processing",
                      stage: "embedding",
                      totalChunks: payload.totalChunks ?? doc.totalChunks,
                    };
                  case "document.ready":
                    return {
                      ...doc,
                      status: "ready",
                      stage: undefined,
                      totalPages: payload.totalPages ?? doc.totalPages,
                      totalChunks: payload.totalChunks ?? doc.totalChunks,
                    };
                  case "document.failed":
                    return {
                      ...doc,
                      status: "failed",
                      stage: undefined,
                      errorMessage: payload.error || "Ingestion pipeline failed",
                    };
                  default:
                    return doc;
                }
              })
            );

            // Reconcile document state with database when ready or failed
            if (type === "document.ready" || type === "document.failed") {
              if (reconcileTimerRef.current) clearTimeout(reconcileTimerRef.current);
              reconcileTimerRef.current = setTimeout(() => {
                getDocuments(token)
                  .then((res) => {
                    if (!isUnmounted && res.documents) {
                      setDocuments((current) =>
                        res.documents.map((remote) => {
                          const local = current.find((c) => c.id === remote.id);
                          return {
                            ...remote,
                            stage: local?.stage,
                            totalPages: local?.totalPages,
                            totalChunks: local?.totalChunks,
                            errorMessage: local?.errorMessage,
                          };
                        })
                      );
                    }
                  })
                  .catch(() => {});
              }, 800);
            }
          } catch {
            // Safely ignore malformed socket frames
          }
        };

        ws.onclose = (event) => {
          if (!isUnmounted && event.code !== 1000) {
            reconnectTimer = setTimeout(connect, 3000);
          }
        };

        ws.onerror = () => {
          ws?.close();
        };
      } catch {
        if (!isUnmounted) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      }
    };

    connect();

    return () => {
      isUnmounted = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (reconcileTimerRef.current) clearTimeout(reconcileTimerRef.current);
      ws?.close();
    };
  }, [token]);

  // In-flight fallback polling (runs only while documents are actively processing)
  useEffect(() => {
    const hasInFlight = documents.some(
      (d) => d.status === "uploaded" || d.status === "processing"
    );
    if (!hasInFlight || !token) return;

    const interval = setInterval(() => {
      getDocuments(token)
        .then((res) => {
          if (res.documents) {
            setDocuments((current) =>
              res.documents.map((remote) => {
                const local = current.find((c) => c.id === remote.id);
                return {
                  ...remote,
                  stage: local?.stage,
                  totalPages: local?.totalPages,
                  totalChunks: local?.totalChunks,
                  errorMessage: local?.errorMessage,
                };
              })
            );
          }
        })
        .catch(() => {});
    }, 2500);

    return () => clearInterval(interval);
  }, [documents, token]);

  // Upload files and append to list
  const upload = async (files: File[]): Promise<boolean> => {
    if (!token || files.length === 0) return false;
    setError(null);
    setSkipped([]);

    try {
      const res = await uploadDocuments(files, token);
      if (res.skipped?.length) setSkipped(res.skipped);

      if (res.uploaded?.length) {
        setDocuments((prev) => [...res.uploaded, ...prev]);
        return true;
      }
      if (res.skipped?.length && !res.uploaded?.length) {
        setError("All files were duplicate and skipped.");
      }
      return false;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      return false;
    }
  };

  // Remove a document by id
  const remove = async (id: string): Promise<boolean> => {
    if (!token) return false;
    try {
      await deleteDocument(id, token);
      setDocuments((prev) => prev.filter((doc) => doc.id !== id));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete document");
      return false;
    }
  };

  return {
    documents,
    isLoading,
    error,
    skipped,
    refresh,
    upload,
    remove,
    clearError: () => setError(null),
  };
}
