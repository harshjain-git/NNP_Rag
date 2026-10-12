import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import { authenticate } from "../src/middleware/auth.middleware.js";
import { requireRole } from "../src/middleware/role.middleware.js";
import { JWT_SECRET } from "../src/config/env.js";
import { ROLE_NAMES } from "../src/database/schema.js";

describe("JWT Authentication & RBAC Middleware", () => {
  let server: http.Server;
  let baseUrl: string;

  before(async () => {
    const app = express();
    app.use(express.json());

    // Test route 1: Authenticated only (any valid role)
    app.get("/test/me", authenticate, (req, res) => {
      res.status(200).json({ user: req.user });
    });

    // Test route 2: Admin only
    app.get(
      "/test/admin",
      authenticate,
      requireRole(ROLE_NAMES.ADMIN, ROLE_NAMES.SUPER_ADMIN),
      (req, res) => {
        res.status(200).json({ message: "Admin access granted", user: req.user });
      }
    );

    // Test route 3: Standard user only
    app.get(
      "/test/user",
      authenticate,
      requireRole(ROLE_NAMES.USER),
      (req, res) => {
        res.status(200).json({ message: "User access granted", user: req.user });
      }
    );

    await new Promise<void>((resolve) => {
      server = http.createServer(app).listen(0, "127.0.0.1", () => {
        const addr = server.address() as { port: number };
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  describe("Authentication Middleware (authenticate)", () => {
    it("should return 401 when Authorization header is missing", async () => {
      const res = await fetch(`${baseUrl}/test/me`);
      assert.equal(res.status, 401);
      const data = (await res.json()) as { error: string };
      assert.ok(data.error.includes("Missing authorization header"));
    });

    it("should return 401 when Authorization header is not Bearer format", async () => {
      const res = await fetch(`${baseUrl}/test/me`, {
        headers: { Authorization: "Basic dXNlcjpwYXNz" },
      });
      assert.equal(res.status, 401);
      const data = (await res.json()) as { error: string };
      assert.ok(data.error.includes("Malformed authorization header"));
    });

    it("should return 401 when Bearer token is empty", async () => {
      const res = await fetch(`${baseUrl}/test/me`, {
        headers: { Authorization: "Bearer   " },
      });
      assert.equal(res.status, 401);
      const data = (await res.json()) as { error: string };
      assert.ok(data.error.includes("Token missing"));
    });

    it("should return 401 when token has an invalid signature", async () => {
      const wrongSecretToken = jwt.sign(
        { sub: "user-123", role: "USER" },
        "wrong-secret-key"
      );
      const res = await fetch(`${baseUrl}/test/me`, {
        headers: { Authorization: `Bearer ${wrongSecretToken}` },
      });
      assert.equal(res.status, 401);
      const data = (await res.json()) as { error: string };
      assert.ok(data.error.includes("Invalid token"));
    });

    it("should return 401 when token is a completely corrupted string", async () => {
      const res = await fetch(`${baseUrl}/test/me`, {
        headers: { Authorization: "Bearer not-a-valid-jwt-token" },
      });
      assert.equal(res.status, 401);
      const data = (await res.json()) as { error: string };
      assert.ok(data.error.includes("Invalid token"));
    });

    it("should return 401 when token has expired", async () => {
      const expiredToken = jwt.sign(
        { sub: "user-123", role: "USER" },
        JWT_SECRET,
        { expiresIn: -10 } // Expired 10 seconds ago
      );
      const res = await fetch(`${baseUrl}/test/me`, {
        headers: { Authorization: `Bearer ${expiredToken}` },
      });
      assert.equal(res.status, 401);
      const data = (await res.json()) as { error: string };
      assert.ok(data.error.includes("Token expired"));
    });

    it("should return 401 when token is missing required claims (sub or role)", async () => {
      const noClaimsToken = jwt.sign(
        { foo: "bar" },
        JWT_SECRET
      );
      const res = await fetch(`${baseUrl}/test/me`, {
        headers: { Authorization: `Bearer ${noClaimsToken}` },
      });
      assert.equal(res.status, 401);
      const data = (await res.json()) as { error: string };
      assert.ok(data.error.includes("Invalid token payload"));
    });

    it("should authenticate valid token and attach req.user with id and role", async () => {
      const validToken = jwt.sign(
        { sub: "user-abc-456", role: ROLE_NAMES.USER },
        JWT_SECRET,
        { expiresIn: "7d" }
      );
      const res = await fetch(`${baseUrl}/test/me`, {
        headers: { Authorization: `Bearer ${validToken}` },
      });
      assert.equal(res.status, 200);
      const data = (await res.json()) as {
        user: { id: string; role: string };
      };
      assert.equal(data.user.id, "user-abc-456");
      assert.equal(data.user.role, ROLE_NAMES.USER);
    });
  });

  describe("Role-Based Access Control (requireRole)", () => {
    it("should return 403 Forbidden when a USER role accesses an ADMIN endpoint", async () => {
      const userToken = jwt.sign(
        { sub: "user-normal", role: ROLE_NAMES.USER },
        JWT_SECRET,
        { expiresIn: "7d" }
      );
      const res = await fetch(`${baseUrl}/test/admin`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      assert.equal(res.status, 403);
      const data = (await res.json()) as { error: string };
      assert.ok(data.error.includes("Insufficient permissions"));
    });

    it("should allow ADMIN role to access ADMIN endpoint", async () => {
      const adminToken = jwt.sign(
        { sub: "admin-1", role: ROLE_NAMES.ADMIN },
        JWT_SECRET,
        { expiresIn: "7d" }
      );
      const res = await fetch(`${baseUrl}/test/admin`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(res.status, 200);
      const data = (await res.json()) as {
        message: string;
        user: { id: string; role: string };
      };
      assert.equal(data.message, "Admin access granted");
      assert.equal(data.user.id, "admin-1");
      assert.equal(data.user.role, ROLE_NAMES.ADMIN);
    });

    it("should allow SUPER_ADMIN role to access ADMIN endpoint", async () => {
      const superAdminToken = jwt.sign(
        { sub: "super-1", role: ROLE_NAMES.SUPER_ADMIN },
        JWT_SECRET,
        { expiresIn: "7d" }
      );
      const res = await fetch(`${baseUrl}/test/admin`, {
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      assert.equal(res.status, 200);
      const data = (await res.json()) as {
        message: string;
        user: { id: string; role: string };
      };
      assert.equal(data.message, "Admin access granted");
      assert.equal(data.user.role, ROLE_NAMES.SUPER_ADMIN);
    });

    it("should return 403 Forbidden when an ADMIN accesses a USER-only endpoint", async () => {
      const adminToken = jwt.sign(
        { sub: "admin-1", role: ROLE_NAMES.ADMIN },
        JWT_SECRET,
        { expiresIn: "7d" }
      );
      const res = await fetch(`${baseUrl}/test/user`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(res.status, 403);
      const data = (await res.json()) as { error: string };
      assert.ok(data.error.includes("Insufficient permissions"));
    });

    it("should allow USER role to access USER endpoint", async () => {
      const userToken = jwt.sign(
        { sub: "user-regular", role: ROLE_NAMES.USER },
        JWT_SECRET,
        { expiresIn: "7d" }
      );
      const res = await fetch(`${baseUrl}/test/user`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      assert.equal(res.status, 200);
      const data = (await res.json()) as {
        message: string;
        user: { id: string; role: string };
      };
      assert.equal(data.message, "User access granted");
      assert.equal(data.user.role, ROLE_NAMES.USER);
    });
  });
});
