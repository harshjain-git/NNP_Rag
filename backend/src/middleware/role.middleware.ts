import type { Request, Response, NextFunction } from "express";
import type { RoleName } from "../database/schema.js";

/**
 * Role-Based Access Control (RBAC) middleware generator.
 * Asserts that the authenticated user (`req.user`) has one of the allowed roles.
 * Returns 401 Unauthorized if the user is unauthenticated.
 * Returns 403 Forbidden if the user's role is not permitted.
 */
export const requireRole = (...allowedRoles: (RoleName | string)[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized: Authentication required" });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: "Forbidden: Insufficient permissions" });
      return;
    }

    next();
  };
};

export default requireRole;
