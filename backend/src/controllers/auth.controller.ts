import type { Request, Response } from "express";
import {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  changeUserPassword,
} from "../services/auth.service.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const registerController = async (req: Request, res: Response): Promise<void> => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!name) return void res.status(400).json({ error: "Name is required" });
  if (!email || !EMAIL_REGEX.test(email)) return void res.status(400).json({ error: "Valid email is required" });
  if (password.length < 8) return void res.status(400).json({ error: "Password must be at least 8 characters long" });

  try {
    const result = await registerUser(name, email.toLowerCase(), password);
    if ("error" in result) return void res.status(409).json({ error: "Email is already registered" });
    res.status(201).json(result);
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
};

export const loginController = async (req: Request, res: Response): Promise<void> => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!email || !password) return void res.status(400).json({ error: "Email and password are required" });

  try {
    const result = await loginUser(email.toLowerCase(), password);
    if (!result) return void res.status(401).json({ error: "Invalid email or password" });
    res.status(200).json(result);
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
};

export const getProfileController = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getUserProfile(req.user!.id);
    if (!user) return void res.status(404).json({ error: "User not found" });
    res.status(200).json({ user });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
};

export const updateProfileController = async (req: Request, res: Response): Promise<void> => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name || name.length > 100) return void res.status(400).json({ error: "Valid name (1-100 characters) is required" });

  try {
    const user = await updateUserProfile(req.user!.id, name);
    if (!user) return void res.status(404).json({ error: "User not found" });
    res.status(200).json({ message: "Profile updated successfully", user });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
};

export const changePasswordController = async (req: Request, res: Response): Promise<void> => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (!currentPassword || typeof currentPassword !== "string") return void res.status(400).json({ error: "Current password is required" });
  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
    return void res.status(400).json({ error: "New password must be at least 8 characters long" });
  }

  try {
    const result = await changeUserPassword(req.user!.id, currentPassword, newPassword);
    if (!result.success) {
      const errMap: Record<string, string> = {
        invalidCurrentPassword: "Current password is incorrect",
        samePassword: "New password must be different from current password",
      };
      return void res.status(400).json({ error: errMap[result.error!] ?? "Failed to change password" });
    }
    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ error: "Failed to change password" });
  }
};

