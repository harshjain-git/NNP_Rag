import type { Request, Response } from "express";
import { registerUser, loginUser } from "../services/auth.service.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const registerController = async (req: Request, res: Response): Promise<void> => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!name) {
    res.status(400).json({ error: "Name is required" });
    return;
  }
  if (!email || !EMAIL_REGEX.test(email)) {
    res.status(400).json({ error: "Valid email is required" });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters long" });
    return;
  }

  try {
    const result = await registerUser(name, email.toLowerCase(), password);
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
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  try {
    const result = await loginUser(email.toLowerCase(), password);
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

