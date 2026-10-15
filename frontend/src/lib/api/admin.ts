import { request } from "./client";
import type {
  AdminUserListResponse,
  AdminUserResponse,
  CreateAdminUserPayload,
  UpdateUserRolePayload,
  UpdateProjectConfigPayload,
  ProjectConfigResponse,
} from "@/types";


export async function getAdminUsers(
  token?: string | null
): Promise<AdminUserListResponse> {
  return request<AdminUserListResponse>("/api/admin/users", {
    method: "GET",
    token,
  });
}

export async function updateUserRole(
  id: string,
  payload: UpdateUserRolePayload,
  token?: string | null
): Promise<AdminUserResponse> {
  return request<AdminUserResponse>(
    `/api/admin/users/${encodeURIComponent(id)}/role`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
      token,
    }
  );
}

export async function createAdminUser(
  payload: CreateAdminUserPayload,
  token?: string | null
): Promise<AdminUserResponse> {
  return request<AdminUserResponse>("/api/admin/users", {
    method: "POST",
    body: JSON.stringify(payload),
    token,
  });
}

export async function deleteAdminUser(
  id: string,
  token?: string | null
): Promise<AdminUserResponse> {
  return request<AdminUserResponse>(
    `/api/admin/users/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      token,
    }
  );
}

export async function getProjectConfig(
  token?: string | null
): Promise<ProjectConfigResponse> {
  return request<ProjectConfigResponse>("/api/admin/config", {
    method: "GET",
    token,
  });
}

export async function updateProjectConfig(
  payload: UpdateProjectConfigPayload,
  token?: string | null
): Promise<ProjectConfigResponse> {
  return request<ProjectConfigResponse>("/api/admin/config", {
    method: "PATCH",
    body: JSON.stringify(payload),
    token,
  });
}

