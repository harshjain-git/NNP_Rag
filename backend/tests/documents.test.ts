import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import app from "../src/app.js";
import { db, pool } from "../src/database/client.js";
import { documents, documentChunks } from "../src/database/schema.js";

describe("Document Deletion API (DELETE /api/documents/:id)", () => {
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
    await pool.end();
  });

  it("should return 400 when document ID format is invalid", async () => {
    const res = await fetch(`${baseUrl}/api/documents/invalid-uuid-format`, {
      method: "DELETE",
    });

    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: string };
    assert.equal(
      body.error,
      "Invalid document ID format. Expected a valid UUID"
    );
  });

  it("should return 404 when document does not exist", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";
    const res = await fetch(`${baseUrl}/api/documents/${nonExistentId}`, {
      method: "DELETE",
    });

    assert.equal(res.status, 404);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "Document not found");
  });

  it("should successfully delete document, cascade-delete chunks, and remove file from disk", async () => {
    // 1. Create a dummy file in uploads directory
    const uploadsDir = path.resolve(process.cwd(), "uploads");
    await fs.mkdir(uploadsDir, { recursive: true });
    const testFileName = `test-delete-${Date.now()}.txt`;
    const testFilePath = path.join(uploadsDir, testFileName);
    await fs.writeFile(testFilePath, "Sample content for deletion verification.");

    // 2. Insert test document in database
    const relativeFilePath = path.relative(process.cwd(), testFilePath).replace(/\\/g, "/");
    const testHash = crypto.randomBytes(16).toString("hex");

    const [testDoc] = await db
      .insert(documents)
      .values({
        filename: testFileName,
        fileType: "txt",
        filePath: relativeFilePath,
        contentHash: testHash,
        status: "ready",
      })
      .returning();

    assert.ok(testDoc?.id);

    // 3. Insert associated chunks to verify foreign-key cascade deletion
    await db.insert(documentChunks).values([
      {
        documentId: testDoc.id,
        content: "Chunk 1 for cascade verification",
        chunkIndex: 0,
      },
      {
        documentId: testDoc.id,
        content: "Chunk 2 for cascade verification",
        chunkIndex: 1,
      },
    ]);

    // Verify chunks exist prior to deletion
    const chunksBefore = await db
      .select()
      .from(documentChunks)
      .where(eq(documentChunks.documentId, testDoc.id));
    assert.equal(chunksBefore.length, 2);
    assert.ok(fsSync.existsSync(testFilePath));

    // 4. Perform DELETE request
    const res = await fetch(`${baseUrl}/api/documents/${testDoc.id}`, {
      method: "DELETE",
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      message: string;
      documentId: string;
      filename: string;
    };
    assert.equal(body.message, "Document deleted successfully");
    assert.equal(body.documentId, testDoc.id);
    assert.equal(body.filename, testFileName);

    // 5. Verify document record is deleted from PostgreSQL
    const [foundDoc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, testDoc.id));
    assert.equal(foundDoc, undefined);

    // 6. Verify chunks were removed via PostgreSQL foreign-key CASCADE
    const chunksAfter = await db
      .select()
      .from(documentChunks)
      .where(eq(documentChunks.documentId, testDoc.id));
    assert.equal(chunksAfter.length, 0);

    // 7. Verify file was unlinked from disk
    assert.equal(fsSync.existsSync(testFilePath), false);
  });

  it("should succeed when document record exists but file is already missing on disk", async () => {
    // Insert document pointing to non-existent file path
    const testHash = crypto.randomBytes(16).toString("hex");
    const [docWithoutFile] = await db
      .insert(documents)
      .values({
        filename: "already-missing.txt",
        fileType: "txt",
        filePath: "uploads/non-existent-missing-file.txt",
        contentHash: testHash,
        status: "uploaded",
      })
      .returning();

    assert.ok(docWithoutFile?.id);

    const res = await fetch(`${baseUrl}/api/documents/${docWithoutFile.id}`, {
      method: "DELETE",
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as { message: string };
    assert.equal(body.message, "Document deleted successfully");

    const [deletedDoc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, docWithoutFile.id));
    assert.equal(deletedDoc, undefined);
  });
});
