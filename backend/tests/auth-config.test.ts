import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
});
