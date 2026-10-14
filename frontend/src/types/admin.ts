import type { SafeUser, RoleName } from "./auth";

export interface AdminUserListResponse {
  users: SafeUser[];
}

export interface CreateAdminUserPayload {
  name: string;
  email: string;
  password: string;
  role?: RoleName;
}

export interface UpdateUserRolePayload {
  role: RoleName;
}

export interface AdminUserResponse {
  message: string;
  user: SafeUser;
}
