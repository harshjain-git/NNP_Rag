import { request, setAuthToken } from "./client";
import type {
  AuthResponse,
  LoginPayload,
  RegisterPayload,
  UpdateProfilePayload,
  ChangePasswordPayload,
  ProfileResponse,
  MessageResponse,
} from "@/types";

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

export async function getProfile(token?: string | null): Promise<ProfileResponse> {
  return request<ProfileResponse>("/api/auth/me", {
    method: "GET",
    token,
  });
}

export async function updateProfile(
  payload: UpdateProfilePayload,
  token?: string | null
): Promise<ProfileResponse> {
  return request<ProfileResponse>("/api/auth/profile", {
    method: "PATCH",
    body: JSON.stringify(payload),
    token,
  });
}

export async function changePassword(
  payload: ChangePasswordPayload,
  token?: string | null
): Promise<MessageResponse> {
  return request<MessageResponse>("/api/auth/password", {
    method: "PATCH",
    body: JSON.stringify(payload),
    token,
  });
}

export function logout(): void {
  setAuthToken(null);
}
