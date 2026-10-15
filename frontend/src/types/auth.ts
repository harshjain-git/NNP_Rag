export type RoleName = "USER" | "ADMIN" | "SUPER_ADMIN";

export interface User {
  id: string;
  name: string;
  email: string;
  role: RoleName | string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: RoleName;
  createdAt: string;
  updatedAt?: string;
}

export interface AuthResponse {
  user: {
    id: string;
    name: string;
    email: string;
    role: RoleName | string;
  };
  token: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface UpdateProfilePayload {
  name: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface ProfileResponse {
  user: User;
  message?: string;
}

export interface MessageResponse {
  message: string;
}
