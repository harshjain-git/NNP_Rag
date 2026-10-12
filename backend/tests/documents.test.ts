import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import app from "../src/app.js";
import { db, pool } from "../src/database/client.js";
import { documents, documentChunks, ROLE_NAMES } from "../src/database/schema.js";
import { JWT_SECRET } from "../src/config/env.js";
import { uploadDocuments } from "../src/services/document.service.js";
import { waitForIngestionQueueIdle } from "../src/rag/ingestion/queue.js";

describe("Document APIs — Authentication, RBAC, and Lifecycle", () => {
  let server: http.Server;
  let baseUrl: string;

  const adminUserId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const superAdminUserId = crypto.randomUUID();

  const adminToken = jwt.sign(
    { sub: adminUserId, role: ROLE_NAMES.ADMIN },
    JWT_SECRET
  );
  const userToken = jwt.sign(
    { sub: userId, role: ROLE_NAMES.USER },
    JWT_SECRET
  );
  const superAdminToken = jwt.sign(
    { sub: superAdminUserId, role: ROLE_NAMES.SUPER_ADMIN },
    JWT_SECRET
  );

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
    await waitForIngestionQueueIdle();
    await pool.end();
  });

  describe("Document Authentication & RBAC Access Control", () => {
    it("should return 401 when uploading documents without authentication", async () => {
      const res = await fetch(`${baseUrl}/api/documents/upload`, {
        method: "POST",
      });
      assert.equal(res.status, 401);
      const data = (await res.json()) as { error: string };
      assert.ok(data.error.includes("Missing authorization header"));
    });

    it("should return 403 Forbidden when a USER role attempts to upload documents", async () => {
      const res = await fetch(`${baseUrl}/api/documents/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });
      assert.equal(res.status, 403);
      const data = (await res.json()) as { error: string };
      assert.ok(data.error.includes("Forbidden"));
    });

    it("should return 401 when listing documents without authentication", async () => {
      const res = await fetch(`${baseUrl}/api/documents`);
      assert.equal(res.status, 401);
      const data = (await res.json()) as { error: string };
      assert.ok(data.error.includes("Missing authorization header"));
    });

    it("should allow USER role to list documents", async () => {
      const res = await fetch(`${baseUrl}/api/documents`, {
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });
      assert.equal(res.status, 200);
      const data = (await res.json()) as { documents: unknown[] };
      assert.ok(Array.isArray(data.documents));
    });

    it("should allow ADMIN role to list documents", async () => {
      const res = await fetch(`${baseUrl}/api/documents`, {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });
      assert.equal(res.status, 200);
      const data = (await res.json()) as { documents: unknown[] };
      assert.ok(Array.isArray(data.documents));
    });

    it("should return 401 when fetching a document by ID without authentication", async () => {
      const res = await fetch(`${baseUrl}/api/documents/00000000-0000-0000-0000-000000000000`);
      assert.equal(res.status, 401);
      const data = (await res.json()) as { error: string };
      assert.ok(data.error.includes("Missing authorization header"));
    });

    it("should return 400 when fetching document with invalid UUID format", async () => {
      const res = await fetch(`${baseUrl}/api/documents/not-a-uuid`, {
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });
      assert.equal(res.status, 400);
      const data = (await res.json()) as { error: string };
      assert.equal(data.error, "Invalid document ID format. Expected a valid UUID");
    });

    it("should return 404 when fetching document that does not exist", async () => {
      const res = await fetch(
        `${baseUrl}/api/documents/00000000-0000-0000-0000-000000000000`,
        {
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }
      );
      assert.equal(res.status, 404);
      const data = (await res.json()) as { error: string };
      assert.equal(data.error, "Document not found");
    });

    it("should return 401 when deleting a document without authentication", async () => {
      const res = await fetch(
        `${baseUrl}/api/documents/00000000-0000-0000-0000-000000000000`,
        {
          method: "DELETE",
        }
      );
      assert.equal(res.status, 401);
      const data = (await res.json()) as { error: string };
      assert.ok(data.error.includes("Missing authorization header"));
    });

    it("should return 403 Forbidden when a USER role attempts to delete a document", async () => {
      const res = await fetch(
        `${baseUrl}/api/documents/00000000-0000-0000-0000-000000000000`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }
      );
      assert.equal(res.status, 403);
      const data = (await res.json()) as { error: string };
      assert.ok(data.error.includes("Forbidden"));
    });
  });

  describe("Document Ownership Tracking (uploaded_by)", () => {
    it("should persist uploadedBy user ID in uploadDocuments service", async () => {
      const testHash = crypto.randomBytes(16).toString("hex");
      const [doc] = await uploadDocuments(
        [
          {
            filename: "ownership-test.txt",
            fileType: "txt",
            filePath: "uploads/ownership-test.txt",
            contentHash: testHash,
          },
        ],
        adminUserId
      );

      assert.ok(doc?.id);
      assert.equal(doc.uploadedBy, adminUserId);

      // Clean up test document
      await db.delete(documents).where(eq(documents.id, doc.id));
    });

    it("should record uploader user ID when uploading document via HTTP API", async () => {
      const uploadsDir = path.resolve(process.cwd(), "uploads");
      await fs.mkdir(uploadsDir, { recursive: true });

      const testContent = `Document ownership test content ${Date.now()}`;
      const blob = new Blob([testContent], { type: "text/plain" });
      const formData = new FormData();
      formData.append("file", blob, `auth-upload-${Date.now()}.txt`);

      const res = await fetch(`${baseUrl}/api/documents/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        body: formData,
      });

      assert.equal(res.status, 201);
      const body = (await res.json()) as {
        message: string;
        uploaded: { id: string; uploadedBy: string }[];
      };
      assert.ok(body.uploaded.length > 0);
      const uploadedId = body.uploaded[0]!.id;

      // Query database directly to verify uploaded_by column was populated
      const [persistedDoc] = await db
        .select()
        .from(documents)
        .where(eq(documents.id, uploadedId));

      assert.ok(persistedDoc);
      assert.equal(persistedDoc.uploadedBy, adminUserId);

      // Wait for ingestion queue to finish processing before cleanup
      await waitForIngestionQueueIdle();

      // Clean up created file and record
      await db.delete(documents).where(eq(documents.id, uploadedId));
      if (persistedDoc.filePath) {
        const fullPath = path.resolve(process.cwd(), persistedDoc.filePath);
        try {
          await fs.unlink(fullPath);
        } catch {}
      }
    });
  });

  describe("Document Deletion API (DELETE /api/documents/:id)", () => {
    it("should return 400 when document ID format is invalid", async () => {
      const res = await fetch(`${baseUrl}/api/documents/invalid-uuid-format`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
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
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
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
          uploadedBy: adminUserId,
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

      // 4. Perform DELETE request with admin authorization
      const res = await fetch(`${baseUrl}/api/documents/${testDoc.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
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
        headers: {
          Authorization: `Bearer ${superAdminToken}`,
        },
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
});
