import type { Request, Response } from "express";
import { listUsers, updateUserRole, createAdminUser, deleteUser } from "../services/admin.service.js";
import { ROLE_NAMES, type RoleName } from "../database/schema.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES = new Set(Object.values(ROLE_NAMES));

const parseUuidParam = (param: unknown): string | null => {
  const id = typeof param === "string" ? param.trim() : "";
  return UUID_REGEX.test(id) ? id : null;
};

export const listUsersController = async (_req: Request, res: Response): Promise<void> => {
  try {
    const users = await listUsers();
    res.status(200).json({ users });
  } catch (error) {
    console.error("List users error:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
};

export const updateUserRoleController = async (req: Request, res: Response): Promise<void> => {
  const id = parseUuidParam(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid user ID format. Expected a valid UUID" });
    return;
  }

  const { role } = (req.body ?? {}) as { role?: unknown };
  if (!role || typeof role !== "string" || !VALID_ROLES.has(role as RoleName)) {
    res.status(400).json({ error: `Invalid role. Allowed roles are: ${Object.values(ROLE_NAMES).join(", ")}` });
    return;
  }

  try {
    const result = await updateUserRole(req.user!.id, id, role as RoleName);
    if ("error" in result) {
      const errorMap: Record<string, { status: number; message: string }> = {
        notFound: { status: 404, message: "User not found" },
        selfDemotion: { status: 400, message: "Cannot demote yourself from SUPER_ADMIN role" },
        lastSuperAdmin: { status: 400, message: "Cannot demote the last remaining Super Admin in the system" },
      };
      const err = errorMap[result.error] ?? { status: 400, message: "Invalid role update request" };
      res.status(err.status).json({ error: err.message });
      return;
    }

    res.status(200).json({ message: "User role updated successfully", user: result.user });
  } catch (error) {
    console.error("Update role error:", error);
    res.status(500).json({ error: "Failed to update user role" });
  }
};

export const createUserByAdminController = async (req: Request, res: Response): Promise<void> => {
  const { name, email, password, role } = (req.body ?? {}) as {
    name?: string;
    email?: string;
    password?: string;
    role?: unknown;
  };

  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "Name is required" });
    return;
  }
  if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
    res.status(400).json({ error: "Valid email is required" });
    return;
  }
  if (!password || typeof password !== "string" || password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters long" });
    return;
  }

  const targetRole = role !== undefined ? role : ROLE_NAMES.ADMIN;
  if (typeof targetRole !== "string" || !VALID_ROLES.has(targetRole as RoleName)) {
    res.status(400).json({ error: `Invalid role. Allowed roles are: ${Object.values(ROLE_NAMES).join(", ")}` });
    return;
  }

  try {
    const result = await createAdminUser(name.trim(), email.trim().toLowerCase(), password, targetRole as RoleName);
    if ("error" in result) {
      if (result.error === "conflict") {
        res.status(409).json({ error: "Email is already registered" });
        return;
      }
      res.status(400).json({ error: "Invalid user creation request" });
      return;
    }

    res.status(201).json({ message: "User created successfully", user: result.user });
  } catch (error) {
    console.error("Create admin user error:", error);
    res.status(500).json({ error: "Failed to create user" });
  }
};

export const deleteUserController = async (req: Request, res: Response): Promise<void> => {
  const id = parseUuidParam(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid user ID format. Expected a valid UUID" });
    return;
  }

  try {
    const result = await deleteUser(req.user!.id, id);
    if ("error" in result) {
      const errorMap: Record<string, { status: number; message: string }> = {
        notFound: { status: 404, message: "User not found" },
        selfDeletion: { status: 400, message: "Cannot delete your own account" },
        lastSuperAdmin: { status: 400, message: "Cannot delete the last remaining Super Admin in the system" },
      };
      const err = errorMap[result.error] ?? { status: 400, message: "Invalid user deletion request" };
      res.status(err.status).json({ error: err.message });
      return;
    }

    res.status(200).json({ message: "User deleted successfully", user: result.user });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
};

export const getProjectConfigController = async (_req: Request, res: Response): Promise<void> => {
  try {
    const { getProjectConfig } = await import("../services/config.service.js");
    const config = getProjectConfig();
    res.status(200).json({ config });
  } catch (error) {
    console.error("Get project config error:", error);
    res.status(500).json({ error: "Failed to fetch project configuration" });
  }
};

export const updateProjectConfigController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { updateProjectConfig } = await import("../services/config.service.js");
    const result = updateProjectConfig(req.body ?? {});
    if (result.error) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(200).json({ message: "Project configuration updated successfully", config: result.config });
  } catch (error) {
    console.error("Update project config error:", error);
    res.status(500).json({ error: "Failed to update project configuration" });
  }
};


