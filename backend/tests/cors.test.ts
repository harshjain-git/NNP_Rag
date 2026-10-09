import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import app from "../src/app.js";
import { CORS_ORIGIN } from "../src/config/env.js";

describe("CORS Configuration & Security", () => {
  let server: http.Server;
  let baseUrl: string;

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
  });

  it("should configure development defaults for CORS_ORIGIN", () => {
    assert.ok(Array.isArray(CORS_ORIGIN));
    assert.ok(CORS_ORIGIN.includes("http://localhost:3000"));
    assert.ok(CORS_ORIGIN.includes("http://localhost:3001"));
  });

  it("should allow request from authorized origin and set credentials header", async () => {
    const res = await fetch(`${baseUrl}/`, {
      method: "GET",
      headers: { Origin: "http://localhost:3000" },
    });

    assert.equal(res.status, 200);
    assert.equal(
      res.headers.get("access-control-allow-origin"),
      "http://localhost:3000"
    );
    assert.equal(res.headers.get("access-control-allow-credentials"), "true");
  });

  it("should allow request from secondary configured origin (http://localhost:3001)", async () => {
    const res = await fetch(`${baseUrl}/`, {
      method: "GET",
      headers: { Origin: "http://localhost:3001" },
    });

    assert.equal(res.status, 200);
    assert.equal(
      res.headers.get("access-control-allow-origin"),
      "http://localhost:3001"
    );
    assert.equal(res.headers.get("access-control-allow-credentials"), "true");
  });

  it("should not set allow-origin header for unauthorized origins", async () => {
    const res = await fetch(`${baseUrl}/`, {
      method: "GET",
      headers: { Origin: "https://malicious-site.example.com" },
    });

    assert.equal(res.status, 200);
    assert.equal(res.headers.get("access-control-allow-origin"), null);
  });

  it("should handle preflight OPTIONS request for authorized origin", async () => {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:3000",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type, Authorization",
      },
    });

    assert.equal(res.status, 204);
    assert.equal(
      res.headers.get("access-control-allow-origin"),
      "http://localhost:3000"
    );
    assert.equal(res.headers.get("access-control-allow-credentials"), "true");
    const allowedMethods = res.headers.get("access-control-allow-methods") || "";
    assert.ok(allowedMethods.includes("POST"));
    const allowedHeaders = res.headers.get("access-control-allow-headers") || "";
    assert.ok(allowedHeaders.toLowerCase().includes("authorization"));
  });

  it("should reject preflight OPTIONS request for unauthorized origin", async () => {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://malicious-site.example.com",
        "Access-Control-Request-Method": "POST",
      },
    });

    assert.equal(res.headers.get("access-control-allow-origin"), null);
  });

  it("should serve requests without Origin header without adding CORS headers", async () => {
    const res = await fetch(`${baseUrl}/`, {
      method: "GET",
    });

    assert.equal(res.status, 200);
    assert.equal(res.headers.get("access-control-allow-origin"), null);
  });
});
