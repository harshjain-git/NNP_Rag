import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import app from "../src/app.js";
import { db, pool } from "../src/database/client.js";
import { users } from "../src/database/schema.js";
import {
  JWT_SECRET,
  JWT_EXPIRES_IN,
  NODE_ENV,
  validateJwtSecret,
} from "../src/config/env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..");

describe("Authentication Configuration Foundation", () => {
  describe("JWT Secret Validation & Production Enforcement", () => {
    it("should throw an error in production when JWT_SECRET is undefined", () => {
      assert.throws(
        () => validateJwtSecret(undefined, "production"),
        /JWT_SECRET is not defined in environment variables for production/
      );
    });

    it("should throw an error in production when JWT_SECRET is empty", () => {
      assert.throws(
        () => validateJwtSecret("", "production"),
        /JWT_SECRET is not defined in environment variables for production/
      );
    });

    it("should throw an error in production when JWT_SECRET is whitespace only", () => {
      assert.throws(
        () => validateJwtSecret("   ", "production"),
        /JWT_SECRET is not defined in environment variables for production/
      );
    });

    it("should succeed in production when JWT_SECRET is provided", () => {
      const secret = "production-super-secret-key-12345";
      const validated = validateJwtSecret(secret, "production");
      assert.equal(validated, secret);
    });

    it("should never use an insecure fallback secret when unset in non-production", () => {
      const devValidated = validateJwtSecret(undefined, "development");
      assert.equal(devValidated, "");
      assert.notEqual(devValidated, "secret");
      assert.notEqual(devValidated, "default");
      assert.notEqual(devValidated, "changeme");

      const testValidated = validateJwtSecret(undefined, "test");
      assert.equal(testValidated, "");
    });

    it("should return the configured secret when provided in non-production", () => {
      const customSecret = "dev-custom-secret";
      assert.equal(validateJwtSecret(customSecret, "development"), customSecret);
    });
  });

  describe("Exported Authentication Environment Configuration", () => {
    it("should export JWT_SECRET as a valid string", () => {
      assert.equal(typeof JWT_SECRET, "string");
    });

    it("should export JWT_EXPIRES_IN with sensible default or configured duration", () => {
      assert.equal(typeof JWT_EXPIRES_IN, "string");
      assert.ok(
        JWT_EXPIRES_IN.length > 0,
        "JWT_EXPIRES_IN must not be empty"
      );
      assert.ok(
        JWT_EXPIRES_IN === "7d" || /^\d+[smhdwy]$/.test(JWT_EXPIRES_IN),
        "JWT_EXPIRES_IN must represent a valid lifespan format like 7d"
      );
    });

    it("should export NODE_ENV", () => {
      assert.equal(typeof NODE_ENV, "string");
      assert.ok(NODE_ENV.length > 0);
    });
  });

  describe("Environment Example & Dependency Foundation", () => {
    it("should document JWT_SECRET and JWT_EXPIRES_IN in .env.example", () => {
      const envExamplePath = path.join(backendRoot, ".env.example");
      assert.ok(fs.existsSync(envExamplePath), ".env.example must exist");

      const content = fs.readFileSync(envExamplePath, "utf-8");
      assert.ok(
        content.includes("JWT_SECRET="),
        ".env.example must document JWT_SECRET"
      );
      assert.ok(
        content.includes("JWT_EXPIRES_IN="),
        ".env.example must document JWT_EXPIRES_IN"
      );
    });

    it("should have jsonwebtoken and bcrypt installed with TypeScript types", () => {
      const packageJsonPath = path.join(backendRoot, "package.json");
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

      assert.ok(
        pkg.dependencies?.jsonwebtoken,
        "jsonwebtoken must be in dependencies"
      );
      assert.ok(
        pkg.dependencies?.bcrypt,
        "bcrypt must be in dependencies"
      );
      assert.ok(
        pkg.devDependencies?.["@types/jsonwebtoken"],
        "@types/jsonwebtoken must be in devDependencies"
      );
      assert.ok(
        pkg.devDependencies?.["@types/bcrypt"],
        "@types/bcrypt must be in devDependencies"
      );
    });
  });

  describe("Authentication Endpoints (POST /api/auth/register & /api/auth/login)", () => {
    let server: http.Server;
    let baseUrl: string;
    const testEmail = `test-user-${Date.now()}@example.com`;
    const testPassword = "securePassword123";
    const testName = "Test User";

    before(async () => {
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
      // Clean up test user from database
      await db.delete(users).where(eq(users.email, testEmail));
    });

    it("should return 400 when name is missing or empty in registration", async () => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testEmail, password: testPassword }),
      });
      assert.equal(res.status, 400);
      const data = (await res.json()) as { error: string };
      assert.equal(data.error, "Name is required");
    });

    it("should return 400 when email is invalid in registration", async () => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: testName, email: "invalid-email", password: testPassword }),
      });
      assert.equal(res.status, 400);
      const data = (await res.json()) as { error: string };
      assert.equal(data.error, "Valid email is required");
    });

    it("should return 400 when password is shorter than 8 characters", async () => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: testName, email: testEmail, password: "short" }),
      });
      assert.equal(res.status, 400);
      const data = (await res.json()) as { error: string };
      assert.equal(data.error, "Password must be at least 8 characters long");
    });

    it("should register user, assign USER role server-side, and return token and safe user details", async () => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Try passing role: "SUPER_ADMIN" to ensure client-supplied role is ignored
        body: JSON.stringify({
          name: testName,
          email: testEmail,
          password: testPassword,
          role: "SUPER_ADMIN",
        }),
      });

      assert.equal(res.status, 201);
      const data = (await res.json()) as {
        user: { id: string; name: string; email: string; role: string; passwordHash?: string };
        token: string;
      };

      assert.ok(data.token && data.token.length > 0);
      assert.equal(data.user.name, testName);
      assert.equal(data.user.email, testEmail);
      assert.equal(data.user.role, "USER"); // strictly server-assigned
      assert.equal(data.user.passwordHash, undefined); // password hash never exposed
    });

    it("should return 409 conflict when registering with already existing email", async () => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Another Name",
          email: testEmail,
          password: testPassword,
        }),
      });

      assert.equal(res.status, 409);
      const data = (await res.json()) as { error: string };
      assert.equal(data.error, "Email is already registered");
    });

    it("should return 400 when email or password is missing in login", async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testEmail }),
      });
      assert.equal(res.status, 400);
    });

    it("should return 401 with generic error for non-existent email in login", async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "non-existent@example.com",
          password: testPassword,
        }),
      });

      assert.equal(res.status, 401);
      const data = (await res.json()) as { error: string };
      assert.equal(data.error, "Invalid email or password");
    });

    it("should return 401 with generic error for incorrect password in login", async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testEmail,
          password: "wrongPassword123",
        }),
      });

      assert.equal(res.status, 401);
      const data = (await res.json()) as { error: string };
      assert.equal(data.error, "Invalid email or password");
    });

    it("should log in successfully with valid credentials and return JWT token and safe user", async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
        }),
      });

      assert.equal(res.status, 200);
      const data = (await res.json()) as {
        user: { id: string; name: string; email: string; role: string; passwordHash?: string };
        token: string;
      };

      assert.ok(data.token && data.token.length > 0);
      assert.equal(data.user.email, testEmail);
      assert.equal(data.user.role, "USER");
      assert.equal(data.user.passwordHash, undefined);
    });
  });

  describe("Super Admin Seeding & Authentication", () => {
    let server: http.Server;
    let baseUrl: string;
    const adminEmail = `seeded-admin-${Date.now()}@example.com`;
    const adminPassword = "SuperAdminPassword123!";
    const adminName = "System Super Admin";

    before(async () => {
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
      // Clean up test seeded admin user
      await db.delete(users).where(eq(users.email, adminEmail));
      await pool.end();
    });

    it("should seed a new SUPER_ADMIN user idempotently", async () => {
      const { seedSuperAdmin } = await import("../src/database/seed.js");
      const result = await seedSuperAdmin({
        name: adminName,
        email: adminEmail,
        password: adminPassword,
      });

      assert.ok(result.user?.id);
      assert.equal(result.user.email, adminEmail);
      assert.equal(result.created, true);

      // Re-running should be idempotent
      const secondRun = await seedSuperAdmin({
        name: adminName,
        email: adminEmail,
        password: adminPassword,
      });
      assert.equal(secondRun.created, false);
      assert.equal(secondRun.elevated, false);
    });

    it("should allow seeded SUPER_ADMIN to log in and receive SUPER_ADMIN role claim", async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: adminEmail,
          password: adminPassword,
        }),
      });

      assert.equal(res.status, 200);
      const data = (await res.json()) as {
        user: { id: string; email: string; role: string };
        token: string;
      };

      assert.ok(data.token && data.token.length > 0);
      assert.equal(data.user.email, adminEmail);
      assert.equal(data.user.role, "SUPER_ADMIN");
    });
  });
});
