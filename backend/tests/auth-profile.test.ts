import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import crypto from "node:crypto";
import app from "../src/app.js";
import { registerUser } from "../src/services/auth.service.js";

describe("User Profile & Password Management APIs", () => {
  let server: http.Server;
  let baseUrl: string;

  const testEmail = `profile_test_${crypto.randomUUID().slice(0, 8)}@example.com`;
  const initialPassword = "InitialPassword123!";
  const newPassword = "UpdatedPassword456!";
  let testToken = "";
  let testUserId = "";

  before(async () => {
    // Register a test user
    const reg = await registerUser("Initial User", testEmail, initialPassword);
    if ("error" in reg) throw new Error("Failed to register test user");
    testToken = reg.token;
    testUserId = reg.user.id;

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

  describe("GET /api/auth/me", () => {
    it("should return 401 when unauthenticated", async () => {
      const res = await fetch(`${baseUrl}/api/auth/me`);
      assert.equal(res.status, 401);
    });

    it("should return 200 with user profile when authenticated", async () => {
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${testToken}` },
      });
      assert.equal(res.status, 200);
      const data = (await res.json()) as { user: any };
      assert.equal(data.user.id, testUserId);
      assert.equal(data.user.email, testEmail);
      assert.equal(data.user.name, "Initial User");
      assert.equal(data.user.role, "USER");
      assert.equal(data.user.passwordHash, undefined);
    });
  });

  describe("PATCH /api/auth/profile", () => {
    it("should return 401 when unauthenticated", async () => {
      const res = await fetch(`${baseUrl}/api/auth/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Name" }),
      });
      assert.equal(res.status, 401);
    });

    it("should return 400 when name is empty or missing", async () => {
      const res = await fetch(`${baseUrl}/api/auth/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${testToken}`,
        },
        body: JSON.stringify({ name: "   " }),
      });
      assert.equal(res.status, 400);
    });

    it("should successfully update user name and preserve role", async () => {
      const res = await fetch(`${baseUrl}/api/auth/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${testToken}`,
        },
        body: JSON.stringify({ name: "Updated Name", role: "SUPER_ADMIN" }),
      });
      assert.equal(res.status, 200);
      const data = (await res.json()) as { message: string; user: any };
      assert.equal(data.user.name, "Updated Name");
      assert.equal(data.user.role, "USER"); // Role cannot be escalated

      // Verify GET returns updated name
      const verifyRes = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${testToken}` },
      });
      const verifyData = (await verifyRes.json()) as { user: any };
      assert.equal(verifyData.user.name, "Updated Name");
    });
  });

  describe("PATCH /api/auth/password", () => {
    it("should return 401 when unauthenticated", async () => {
      const res = await fetch(`${baseUrl}/api/auth/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: initialPassword,
          newPassword,
        }),
      });
      assert.equal(res.status, 401);
    });

    it("should return 400 when current password is incorrect", async () => {
      const res = await fetch(`${baseUrl}/api/auth/password`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${testToken}`,
        },
        body: JSON.stringify({
          currentPassword: "WrongPassword999!",
          newPassword,
        }),
      });
      assert.equal(res.status, 400);
      const data = (await res.json()) as { error: string };
      assert.match(data.error, /Current password is incorrect/);
    });

    it("should return 400 when new password is too short", async () => {
      const res = await fetch(`${baseUrl}/api/auth/password`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${testToken}`,
        },
        body: JSON.stringify({
          currentPassword: initialPassword,
          newPassword: "short",
        }),
      });
      assert.equal(res.status, 400);
    });

    it("should return 400 when new password is identical to current password", async () => {
      const res = await fetch(`${baseUrl}/api/auth/password`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${testToken}`,
        },
        body: JSON.stringify({
          currentPassword: initialPassword,
          newPassword: initialPassword,
        }),
      });
      assert.equal(res.status, 400);
      const data = (await res.json()) as { error: string };
      assert.match(data.error, /New password must be different/);
    });

    it("should successfully update password and allow login with new password", async () => {
      const res = await fetch(`${baseUrl}/api/auth/password`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${testToken}`,
        },
        body: JSON.stringify({
          currentPassword: initialPassword,
          newPassword,
        }),
      });
      assert.equal(res.status, 200);

      // Verify login with old password fails
      const oldLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testEmail,
          password: initialPassword,
        }),
      });
      assert.equal(oldLoginRes.status, 401);

      // Verify login with new password succeeds
      const newLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testEmail,
          password: newPassword,
        }),
      });
      assert.equal(newLoginRes.status, 200);
    });
  });
});
