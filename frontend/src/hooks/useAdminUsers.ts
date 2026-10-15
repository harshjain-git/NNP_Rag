"use client";

import { useState, useEffect, useCallback } from "react";
import { getAdminUsers, createAdminUser, updateUserRole, deleteAdminUser } from "@/lib/api/admin";
import type { SafeUser, RoleName, CreateAdminUserPayload } from "@/types";

export function useAdminUsers(token: string | null) {
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(token));
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await getAdminUsers(token);
      setUsers(res.users || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    let active = true;
    if (!token) return;
    getAdminUsers(token)
      .then((res) => { if (active) setUsers(res.users || []); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "Failed to load users"); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [token]);

  const mutate = async (action: () => Promise<{ message?: string }>): Promise<boolean> => {
    if (!token) return false;
    setError(null);
    try {
      const res = await action();
      setSuccessMessage(res.message || "Action completed successfully.");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Operation failed");
      return false;
    }
  };

  const createUser = (payload: CreateAdminUserPayload) =>
    mutate(async () => {
      const res = await createAdminUser(payload, token);
      setUsers((prev) => [res.user, ...prev]);
      return res;
    });

  const changeRole = (id: string, role: RoleName) =>
    mutate(async () => {
      const res = await updateUserRole(id, { role }, token);
      setUsers((prev) => prev.map((u) => (u.id === id ? res.user : u)));
      return res;
    });

  const removeUser = (id: string) =>
    mutate(async () => {
      const res = await deleteAdminUser(id, token);
      setUsers((prev) => prev.filter((u) => u.id !== id));
      return res;
    });

  return {
    users,
    isLoading,
    error,
    successMessage,
    refresh,
    createUser,
    changeRole,
    removeUser,
    clearFeedback: () => {
      setError(null);
      setSuccessMessage(null);
    },
  };
}
