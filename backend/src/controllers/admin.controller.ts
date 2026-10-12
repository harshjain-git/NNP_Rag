import type { Request, Response } from "express";
import { listUsers, updateUserRole, createAdminUser } from "../services/admin.service.js";
import { ROLE_NAMES, type RoleName } from "../database/schema.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES = new Set(Object.values(ROLE_NAMES));

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
  const id = typeof req.params.id === "string" ? req.params.id.trim() : "";
  if (!UUID_REGEX.test(id)) {
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
      if (result.error === "notFound") {
        res.status(404).json({ error: "User not found" });
        return;
      }
      if (result.error === "selfDemotion") {
        res.status(400).json({ error: "Cannot demote yourself from SUPER_ADMIN role" });
        return;
      }
      if (result.error === "lastSuperAdmin") {
        res.status(400).json({ error: "Cannot demote the last remaining Super Admin in the system" });
        return;
      }
      res.status(400).json({ error: "Invalid role update request" });
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
