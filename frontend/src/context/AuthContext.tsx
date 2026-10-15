"use client";

import React, { createContext, useContext, useSyncExternalStore } from "react";
import type { User, LoginPayload, RegisterPayload, AuthResponse } from "@/types";
import { login as apiLogin, register as apiRegister, logout as apiLogout } from "@/lib/api/auth";
import { getAuthToken } from "@/lib/api/client";

const USER_KEY = "nnt_rag_user";

export interface AuthState {
  user: User | null;
  token: string | null;
}

const SERVER_SNAPSHOT: AuthState = { user: null, token: null };

// Pure storage reader
const readStorage = (): AuthState => {
  if (typeof window === "undefined") return SERVER_SNAPSHOT;
  const token = getAuthToken();
  const rawUser = localStorage.getItem(USER_KEY);
  let user: User | null = null;
  if (token && rawUser) {
    try {
      user = JSON.parse(rawUser) as User;
    } catch {
      user = null;
    }
  }
  return { user, token };
};

// 1. Shared Store (Immutable reference updates, pure getSnapshot)
let currentAuth: AuthState = readStorage();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

// Pure snapshot reader: returns currentAuth without mutating anything
const getSnapshot = (): AuthState => currentAuth;
const getServerSnapshot = (): AuthState => SERVER_SNAPSHOT;

const subscribe = (fn: () => void) => {
  listeners.add(fn);

  // Sync state if localStorage changes externally (e.g., in another browser tab)
  const handleStorage = () => {
    const updated = readStorage();
    if (currentAuth.user?.id !== updated.user?.id || currentAuth.token !== updated.token) {
      currentAuth = updated;
      fn();
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorage);
  }

  return () => {
    listeners.delete(fn);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorage);
    }
  };
};

// 2. Auth Context Definition
export interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<AuthResponse>;
  register: (payload: RegisterPayload) => Promise<AuthResponse>;
  logout: () => void;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// 3. Provider Component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const isServer = useSyncExternalStore(
    () => () => {},
    () => false,
    () => true
  );

  const auth = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const login = async (payload: LoginPayload): Promise<AuthResponse> => {
    const res = await apiLogin(payload);
    if (typeof window !== "undefined") {
      localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    }
    currentAuth = { user: res.user, token: res.token };
    notify();
    return res;
  };

  const register = async (payload: RegisterPayload): Promise<AuthResponse> => {
    const res = await apiRegister(payload);
    if (typeof window !== "undefined") {
      localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    }
    currentAuth = { user: res.user, token: res.token };
    notify();
    return res;
  };

  const logout = (): void => {
    apiLogout();
    if (typeof window !== "undefined") {
      localStorage.removeItem(USER_KEY);
    }
    currentAuth = { user: null, token: null };
    notify();
  };

  const updateUser = (updatedUser: User): void => {
    if (typeof window !== "undefined") {
      localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
    }
    currentAuth = { ...currentAuth, user: updatedUser };
    notify();
  };

  return (
    <AuthContext.Provider
      value={{
        user: auth.user,
        token: auth.token,
        isAuthenticated: Boolean(auth.user && auth.token),
        isLoading: isServer,
        login,
        register,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// 4. Hook for Components
export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
