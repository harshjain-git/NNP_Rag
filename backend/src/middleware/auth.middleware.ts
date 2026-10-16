import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/env.js";
import type { JwtTokenPayload } from "../types/auth.types.js";

const parseCookies = (cookieHeader?: string): Record<string, string> => {
  if (!cookieHeader) return {};
  const cookies: Record<string, string> = {};
  for (const item of cookieHeader.split(";")) {
    const [rawKey, ...rawVal] = item.trim().split("=");
    if (rawKey) {
      cookies[rawKey] = decodeURIComponent(rawVal.join("="));
    }
  }
  return cookies;
};

/**
 * Authentication middleware that verifies JWT bearer tokens or HttpOnly cookies.
 * Extracts `sub` (user id) and `role` claims and attaches `{ id, role }` to `req.user`.
 * Returns 401 Unauthorized for missing, malformed, invalid, or expired tokens.
 */
export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  let token = "";

  if (authHeader) {
    const trimmedHeader = authHeader.trim();
    if (trimmedHeader === "Bearer") {
      res.status(401).json({ error: "Unauthorized: Token missing" });
      return;
    }

    if (!authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized: Malformed authorization header" });
      return;
    }

    token = authHeader.slice(7).trim();
    if (!token) {
      res.status(401).json({ error: "Unauthorized: Token missing" });
      return;
    }
  } else if (req.headers.cookie) {
    const cookies = parseCookies(req.headers.cookie);
    token = cookies["nnt_rag_token"] || "";
    if (!token) {
      res.status(401).json({ error: "Unauthorized: Missing authorization header" });
      return;
    }
  } else {
    res.status(401).json({ error: "Unauthorized: Missing authorization header" });
    return;
  }

  if (!JWT_SECRET) {
    res.status(500).json({ error: "Internal server error: JWT secret not configured" });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (
      typeof decoded !== "object" ||
      !decoded ||
      typeof decoded.sub !== "string" ||
      !("role" in decoded) ||
      typeof (decoded as { role: unknown }).role !== "string"
    ) {
      res.status(401).json({ error: "Unauthorized: Invalid token payload" });
      return;
    }

    const payload = decoded as unknown as JwtTokenPayload;
    req.user = {
      id: payload.sub,
      role: payload.role,
    };

    next();
  } catch (err) {
    if (
      err instanceof jwt.TokenExpiredError ||
      (err as { name?: string })?.name === "TokenExpiredError"
    ) {
      res.status(401).json({ error: "Unauthorized: Token expired" });
      return;
    }

    res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
};

export const authMiddleware = authenticate;
export default authenticate;
