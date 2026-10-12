import type { Request, Response } from "express";
import { registerUser, loginUser } from "../services/auth.service.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const registerController = async (req: Request, res: Response): Promise<void> => {
  const { name, email, password } = (req.body ?? {}) as {
    name?: string;
    email?: string;
    password?: string;
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

  try {
    const result = await registerUser(name.trim(), email.trim().toLowerCase(), password);
    if ("error" in result) {
      res.status(409).json({ error: "Email is already registered" });
      return;
    }

    res.status(201).json(result);
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
};

export const loginController = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = (req.body ?? {}) as {
    email?: string;
    password?: string;
  };

  if (!email || typeof email !== "string" || !email.trim() || !password || typeof password !== "string") {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  try {
    const result = await loginUser(email.trim().toLowerCase(), password);
    if (!result) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    res.status(200).json(result);
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
};
