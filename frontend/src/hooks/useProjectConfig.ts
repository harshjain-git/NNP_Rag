"use client";

import { useState, useEffect, useCallback } from "react";
import { getProjectConfig, updateProjectConfig } from "@/lib/api/admin";
import type { ProjectConfig, UpdateProjectConfigPayload } from "@/types";

export function useProjectConfig(token: string | null) {
  const [config, setConfig] = useState<ProjectConfig | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(token));
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await getProjectConfig(token);
      setConfig(res.config);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load project configuration");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    let active = true;
    if (!token) return;
    getProjectConfig(token)
      .then((res) => { if (active) setConfig(res.config); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "Failed to load project configuration"); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [token]);

  const saveConfig = async (payload: UpdateProjectConfigPayload): Promise<boolean> => {
    if (!token) return false;
    setIsSaving(true);
    setError(null);
    try {
      const res = await updateProjectConfig(payload, token);
      setConfig(res.config);
      setSuccessMessage(res.message || "Project configuration saved successfully.");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update project configuration");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    config,
    isLoading,
    isSaving,
    error,
    successMessage,
    refresh,
    saveConfig,
    clearFeedback: () => {
      setError(null);
      setSuccessMessage(null);
    },
  };
}
