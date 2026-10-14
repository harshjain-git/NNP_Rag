import { request, setAuthToken } from "./client";
import type { AuthResponse, LoginPayload, RegisterPayload } from "@/types";

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const res = await request<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (res.token) setAuthToken(res.token);
  return res;
}

export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  const res = await request<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (res.token) setAuthToken(res.token);
  return res;
}

export function logout(): void {
  setAuthToken(null);
}
