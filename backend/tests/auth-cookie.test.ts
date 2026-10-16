import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import app from "../src/app.js";
import { JWT_SECRET } from "../src/config/env.js";
import { ROLE_NAMES, users, roles } from "../src/database/schema.js";
import { db } from "../src/database/client.js";
import { eq } from "drizzle-orm";

describe("Backend Cookie Authentication & Session Lifecycle", () => {
  let server: http.Server;
  let baseUrl: string;

  const testUserEmail = `cookie-test-${Date.now()}@test.com`;
  const testUserPassword = "Password123!";
  const testUserName = "Cookie Test User";

  let normalUserToken: string;
  let adminToken: string;
  let superAdminToken: string;
  let expiredToken: string;

  before(async () => {
    // 1. Fetch system roles
    const [userRole] = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, ROLE_NAMES.USER))
      .limit(1);

    const [adminRole] = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, ROLE_NAMES.ADMIN))
      .limit(1);

    const [superAdminRole] = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, ROLE_NAMES.SUPER_ADMIN))
      .limit(1);

    const normalUserId = crypto.randomUUID();
    const adminUserId = crypto.randomUUID();
    const superAdminUserId = crypto.randomUUID();

    if (userRole && adminRole && superAdminRole) {
      await db.insert(users).values([
        {
          id: normalUserId,
          name: "Standard Cookie User",
          email: `standard-${Date.now()}@test.com`,
          passwordHash: "dummy-hash",
          roleId: userRole.id,
        },
        {
          id: adminUserId,
          name: "Admin Cookie User",
          email: `admin-${Date.now()}@test.com`,
          passwordHash: "dummy-hash",
          roleId: adminRole.id,
        },
        {
          id: superAdminUserId,
          name: "Super Admin Cookie User",
          email: `superadmin-${Date.now()}@test.com`,
          passwordHash: "dummy-hash",
          roleId: superAdminRole.id,
        },
      ]);
    }

    normalUserToken = jwt.sign(
      { sub: normalUserId, role: ROLE_NAMES.USER },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    adminToken = jwt.sign(
      { sub: adminUserId, role: ROLE_NAMES.ADMIN },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    superAdminToken = jwt.sign(
      { sub: superAdminUserId, role: ROLE_NAMES.SUPER_ADMIN },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    expiredToken = jwt.sign(
      { sub: normalUserId, role: ROLE_NAMES.USER },
      JWT_SECRET,
      { expiresIn: "-10s" }
    );

    // 2. Start backend server
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

  it("should set HttpOnly nnt_rag_token cookie on successful registration", async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: testUserName,
        email: testUserEmail,
        password: testUserPassword,
      }),
    });

    assert.equal(res.status, 201);
    const setCookie = res.headers.get("set-cookie") || "";
    assert.ok(setCookie.includes("nnt_rag_token="));
    assert.ok(setCookie.toLowerCase().includes("httponly"));
    assert.ok(setCookie.toLowerCase().includes("path=/"));
  });

  it("should set HttpOnly nnt_rag_token cookie on successful login", async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testUserEmail,
        password: testUserPassword,
      }),
    });

    assert.equal(res.status, 200);
    const setCookie = res.headers.get("set-cookie") || "";
    assert.ok(setCookie.includes("nnt_rag_token="));
    assert.ok(setCookie.toLowerCase().includes("httponly"));
    assert.ok(setCookie.toLowerCase().includes("path=/"));
  });

  it("should authenticate request to /api/auth/me using Cookie header alone", async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        Cookie: `nnt_rag_token=${normalUserToken}`,
      },
    });

    assert.equal(res.status, 200);
    const data = (await res.json()) as { user: { role: string } };
    assert.equal(data.user.role, "USER");
  });

  it("should clear nnt_rag_token cookie on POST /api/auth/logout", async () => {
    const res = await fetch(`${baseUrl}/api/auth/logout`, {
      method: "POST",
    });

    assert.equal(res.status, 200);
    const setCookie = res.headers.get("set-cookie") || "";
    assert.ok(setCookie.includes("nnt_rag_token=;"));
  });

  it("should reject expired cookie with 401 Unauthorized", async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        Cookie: `nnt_rag_token=${expiredToken}`,
      },
    });

    assert.equal(res.status, 401);
    const data = (await res.json()) as { error: string };
    assert.ok(data.error.includes("Token expired"));
  });

  it("should enforce RBAC via cookie: reject standard user from /api/admin/users", async () => {
    const res = await fetch(`${baseUrl}/api/admin/users`, {
      headers: {
        Cookie: `nnt_rag_token=${normalUserToken}`,
      },
    });

    assert.equal(res.status, 403);
  });

  it("should enforce RBAC via cookie: allow SUPER_ADMIN to access /api/admin/users", async () => {
    const res = await fetch(`${baseUrl}/api/admin/users`, {
      headers: {
        Cookie: `nnt_rag_token=${superAdminToken}`,
      },
    });

    assert.equal(res.status, 200);
  });

  it("should enforce RBAC via cookie: allow ADMIN to access /api/prompts", async () => {
    const res = await fetch(`${baseUrl}/api/prompts`, {
      headers: {
        Cookie: `nnt_rag_token=${adminToken}`,
      },
    });

    assert.equal(res.status, 200);
  });
});
