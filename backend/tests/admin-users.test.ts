import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { eq, inArray } from "drizzle-orm";
import app from "../src/app.js";
import { db, pool } from "../src/database/client.js";
import { users, roles, ROLE_NAMES } from "../src/database/schema.js";
import { JWT_SECRET } from "../src/config/env.js";

describe("Super Admin User Management APIs (/api/admin/users)", () => {
  let server: http.Server;
  let baseUrl: string;

  const superAdminId = crypto.randomUUID();
  const adminId = crypto.randomUUID();
  const regularUserId = crypto.randomUUID();

  const superAdminToken = jwt.sign(
    { sub: superAdminId, role: ROLE_NAMES.SUPER_ADMIN },
    JWT_SECRET
  );
  const adminToken = jwt.sign(
    { sub: adminId, role: ROLE_NAMES.ADMIN },
    JWT_SECRET
  );
  const userToken = jwt.sign(
    { sub: regularUserId, role: ROLE_NAMES.USER },
    JWT_SECRET
  );

  const cleanupEmails: string[] = [];

  before(async () => {
    const [superAdminRole] = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, ROLE_NAMES.SUPER_ADMIN))
      .limit(1);

    const superAdminEmail = `super-admin-suite-${Date.now()}@example.com`;
    cleanupEmails.push(superAdminEmail);

    await db.insert(users).values({
      id: superAdminId,
      name: "Suite Super Admin",
      email: superAdminEmail,
      passwordHash: "dummyHash123",
      roleId: superAdminRole!.id,
    });

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
    if (cleanupEmails.length > 0) {
      await db.delete(users).where(inArray(users.email, cleanupEmails));
    }
    await pool.end();
  });

  describe("GET /api/admin/users", () => {
    it("should return 401 when unauthenticated", async () => {
      const res = await fetch(`${baseUrl}/api/admin/users`);
      assert.equal(res.status, 401);
    });

    it("should return 403 when called by standard USER", async () => {
      const res = await fetch(`${baseUrl}/api/admin/users`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      assert.equal(res.status, 403);
    });

    it("should return 403 when called by ADMIN (only SUPER_ADMIN allowed)", async () => {
      const res = await fetch(`${baseUrl}/api/admin/users`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(res.status, 403);
    });

    it("should return 200 and list safe users without password hashes for SUPER_ADMIN", async () => {
      const res = await fetch(`${baseUrl}/api/admin/users`, {
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });
      assert.equal(res.status, 200);
      const data = (await res.json()) as {
        users: { id: string; name: string; email: string; role: string; passwordHash?: string }[];
      };
      assert.ok(Array.isArray(data.users));
      assert.ok(data.users.length > 0);
      for (const u of data.users) {
        assert.ok(u.id);
        assert.ok(u.email);
        assert.ok(u.role);
        assert.equal(u.passwordHash, undefined);
      }
    });
  });

  describe("POST /api/admin/users", () => {
    const testAdminEmail = `provisioned-admin-${Date.now()}@example.com`;
    cleanupEmails.push(testAdminEmail);

    it("should return 401 when unauthenticated", async () => {
      const res = await fetch(`${baseUrl}/api/admin/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Admin", email: "a@b.com", password: "Password123!" }),
      });
      assert.equal(res.status, 401);
    });

    it("should return 403 when called by standard USER or ADMIN", async () => {
      const res = await fetch(`${baseUrl}/api/admin/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ name: "Admin", email: "a@b.com", password: "Password123!" }),
      });
      assert.equal(res.status, 403);
    });

    it("should return 400 when input validation fails", async () => {
      const res = await fetch(`${baseUrl}/api/admin/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({ name: "", email: "invalid-email", password: "short" }),
      });
      assert.equal(res.status, 400);
    });

    it("should return 400 when role is invalid", async () => {
      const res = await fetch(`${baseUrl}/api/admin/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          name: "Test Admin",
          email: "valid@example.com",
          password: "Password123!",
          role: "SUPER_GOD_ROLE",
        }),
      });
      assert.equal(res.status, 400);
      const data = (await res.json()) as { error: string };
      assert.ok(data.error.includes("Invalid role"));
    });

    it("should successfully create an ADMIN user and allow them to log in", async () => {
      const res = await fetch(`${baseUrl}/api/admin/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          name: "Provisioned Admin",
          email: testAdminEmail,
          password: "SecurePassword123!",
          role: ROLE_NAMES.ADMIN,
        }),
      });

      assert.equal(res.status, 201);
      const data = (await res.json()) as {
        message: string;
        user: { id: string; email: string; role: string; passwordHash?: string };
      };
      assert.equal(data.user.email, testAdminEmail);
      assert.equal(data.user.role, ROLE_NAMES.ADMIN);
      assert.equal(data.user.passwordHash, undefined);

      // Verify the provisioned admin can log in normally via /api/auth/login
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testAdminEmail,
          password: "SecurePassword123!",
        }),
      });
      assert.equal(loginRes.status, 200);
      const loginData = (await loginRes.json()) as { user: { role: string }; token: string };
      assert.equal(loginData.user.role, ROLE_NAMES.ADMIN);
      assert.ok(loginData.token);
    });

    it("should return 409 Conflict when creating user with existing email", async () => {
      const res = await fetch(`${baseUrl}/api/admin/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          name: "Duplicate Admin",
          email: testAdminEmail,
          password: "SecurePassword123!",
          role: ROLE_NAMES.ADMIN,
        }),
      });
      assert.equal(res.status, 409);
    });
  });

  describe("PATCH /api/admin/users/:id/role", () => {
    let targetUser: { id: string; email: string };

    before(async () => {
      const email = `role-target-${Date.now()}@example.com`;
      cleanupEmails.push(email);

      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Target User",
          email,
          password: "UserPassword123!",
        }),
      });
      const data = (await res.json()) as { user: { id: string; email: string } };
      targetUser = data.user;
    });

    it("should return 401 when unauthenticated", async () => {
      const res = await fetch(`${baseUrl}/api/admin/users/${targetUser.id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: ROLE_NAMES.ADMIN }),
      });
      assert.equal(res.status, 401);
    });

    it("should return 403 when called by standard USER or ADMIN", async () => {
      const res = await fetch(`${baseUrl}/api/admin/users/${targetUser.id}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ role: ROLE_NAMES.ADMIN }),
      });
      assert.equal(res.status, 403);
    });

    it("should return 400 when user ID format is invalid", async () => {
      const res = await fetch(`${baseUrl}/api/admin/users/invalid-id/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({ role: ROLE_NAMES.ADMIN }),
      });
      assert.equal(res.status, 400);
    });

    it("should return 400 when role is invalid", async () => {
      const res = await fetch(`${baseUrl}/api/admin/users/${targetUser.id}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({ role: "FAKE_ROLE" }),
      });
      assert.equal(res.status, 400);
    });

    it("should return 404 when target user does not exist", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";
      const res = await fetch(`${baseUrl}/api/admin/users/${nonExistentId}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({ role: ROLE_NAMES.ADMIN }),
      });
      assert.equal(res.status, 404);
    });

    it("should return 400 when Super Admin attempts self-demotion", async () => {
      const res = await fetch(`${baseUrl}/api/admin/users/${superAdminId}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({ role: ROLE_NAMES.USER }),
      });
      assert.equal(res.status, 400);
      const data = (await res.json()) as { error: string };
      assert.ok(data.error.includes("Cannot demote yourself"));
    });

    it("should successfully promote USER to ADMIN", async () => {
      const res = await fetch(`${baseUrl}/api/admin/users/${targetUser.id}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({ role: ROLE_NAMES.ADMIN }),
      });

      assert.equal(res.status, 200);
      const data = (await res.json()) as {
        message: string;
        user: { id: string; role: string };
      };
      assert.equal(data.user.id, targetUser.id);
      assert.equal(data.user.role, ROLE_NAMES.ADMIN);
    });

    it("should successfully demote ADMIN back to USER", async () => {
      const res = await fetch(`${baseUrl}/api/admin/users/${targetUser.id}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({ role: ROLE_NAMES.USER }),
      });

      assert.equal(res.status, 200);
      const data = (await res.json()) as {
        message: string;
        user: { id: string; role: string };
      };
      assert.equal(data.user.id, targetUser.id);
      assert.equal(data.user.role, ROLE_NAMES.USER);
    });
  });
});
