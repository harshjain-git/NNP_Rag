import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { and, eq, inArray } from "drizzle-orm";
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
  const adminUser2Id = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const superAdminUserId = crypto.randomUUID();

  const adminToken = jwt.sign(
    { sub: adminUserId, role: ROLE_NAMES.ADMIN },
    JWT_SECRET
  );
  const adminToken2 = jwt.sign(
    { sub: adminUser2Id, role: ROLE_NAMES.ADMIN },
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

    it("should return 403 Forbidden when an ADMIN attempts to delete a document uploaded by another admin", async () => {
      const testHash = crypto.randomBytes(16).toString("hex");
      const [doc] = await db
        .insert(documents)
        .values({
          filename: "owned-by-admin-1.txt",
          fileType: "txt",
          filePath: "uploads/owned-by-admin-1.txt",
          contentHash: testHash,
          status: "ready",
          uploadedBy: adminUserId,
        })
        .returning();

      const res = await fetch(`${baseUrl}/api/documents/${doc!.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminToken2}` },
      });

      assert.equal(res.status, 403);
      const data = (await res.json()) as { error: string };
      assert.ok(data.error.includes("Forbidden"));

      await db.delete(documents).where(eq(documents.id, doc!.id));
    });

    it("should allow SUPER_ADMIN to delete a document uploaded by another admin", async () => {
      const testHash = crypto.randomBytes(16).toString("hex");
      const [doc] = await db
        .insert(documents)
        .values({
          filename: "owned-by-admin-1-for-sa.txt",
          fileType: "txt",
          filePath: "uploads/owned-by-admin-1-for-sa.txt",
          contentHash: testHash,
          status: "ready",
          uploadedBy: adminUserId,
        })
        .returning();

      const res = await fetch(`${baseUrl}/api/documents/${doc!.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });

      assert.equal(res.status, 200);
      const data = (await res.json()) as { message: string };
      assert.equal(data.message, "Document deleted successfully");

      const [check] = await db.select().from(documents).where(eq(documents.id, doc!.id));
      assert.equal(check, undefined);
    });

    it("should abort deletion and return 500 when filesystem cleanup fails", async () => {
      const uploadsDir = path.resolve(process.cwd(), "uploads");
      const dirName = `dummy-dir-${Date.now()}`;
      const dirPath = path.join(uploadsDir, dirName);
      await fs.mkdir(dirPath, { recursive: true });
      const relativeDirPath = path.relative(process.cwd(), dirPath).replace(/\\/g, "/");

      const testHash = crypto.randomBytes(16).toString("hex");
      const [docWithDir] = await db
        .insert(documents)
        .values({
          filename: "cleanup-failure-doc.txt",
          fileType: "txt",
          filePath: relativeDirPath,
          contentHash: testHash,
          status: "ready",
          uploadedBy: adminUserId,
        })
        .returning();

      const res = await fetch(`${baseUrl}/api/documents/${docWithDir!.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      assert.equal(res.status, 500);
      const data = (await res.json()) as { error: string };
      assert.ok(data.error.includes("Failed to delete document"));

      // Verify the document was NOT deleted from database
      const [persistedDoc] = await db
        .select()
        .from(documents)
        .where(eq(documents.id, docWithDir!.id));
      assert.ok(persistedDoc);

      await fs.rmdir(dirPath);
      await db.delete(documents).where(eq(documents.id, docWithDir!.id));
    });
  });

  describe("Active Document Limits (Maximum 10 Active Documents Per Admin)", () => {
    const limitAdminAId = crypto.randomUUID();
    const limitAdminBId = crypto.randomUUID();
    const limitAdminAToken = jwt.sign(
      { sub: limitAdminAId, role: ROLE_NAMES.ADMIN },
      JWT_SECRET
    );
    const limitAdminBToken = jwt.sign(
      { sub: limitAdminBId, role: ROLE_NAMES.ADMIN },
      JWT_SECRET
    );

    const createdDocIds: string[] = [];

    after(async () => {
      await waitForIngestionQueueIdle();
      if (createdDocIds.length > 0) {
        const docsToDelete = await db
          .select({ id: documents.id, filePath: documents.filePath })
          .from(documents)
          .where(inArray(documents.id, createdDocIds));
        for (const doc of docsToDelete) {
          if (doc.filePath && !doc.filePath.includes("seed-doc")) {
            try {
              await fs.unlink(path.resolve(process.cwd(), doc.filePath));
            } catch {}
          }
        }
        await db.delete(documents).where(inArray(documents.id, createdDocIds));
      }
    });

    it("should enforce independent 10-document limit per admin and reject the 11th upload", async () => {
      // 1. Seed 10 active documents for Admin A
      const seedDocs = [];
      for (let i = 0; i < 10; i++) {
        seedDocs.push({
          filename: `seed-doc-${i}.txt`,
          fileType: "txt",
          filePath: `uploads/seed-doc-${i}.txt`,
          contentHash: crypto.randomBytes(16).toString("hex"),
          status: "ready",
          uploadedBy: limitAdminAId,
        });
      }
      const inserted = await db.insert(documents).values(seedDocs).returning({ id: documents.id });
      createdDocIds.push(...inserted.map((d) => d.id));

      // 2. Admin A attempts to upload an 11th document
      const blob = new Blob(["Attempting 11th document upload"], { type: "text/plain" });
      const formData = new FormData();
      formData.append("file", blob, `eleventh-doc-${Date.now()}.txt`);

      const res = await fetch(`${baseUrl}/api/documents/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${limitAdminAToken}` },
        body: formData,
      });

      assert.equal(res.status, 400);
      const data = (await res.json()) as { error: string };
      assert.ok(data.error.includes("Maximum active document limit of 10 reached"));
    });

    it("should allow another admin to upload documents even when the first admin has reached their limit", async () => {
      // Admin B currently has 0 active documents
      const blob = new Blob(["Admin B independent upload content"], { type: "text/plain" });
      const formData = new FormData();
      formData.append("file", blob, `admin-b-doc-${Date.now()}.txt`);

      const res = await fetch(`${baseUrl}/api/documents/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${limitAdminBToken}` },
        body: formData,
      });

      assert.equal(res.status, 201);
      const data = (await res.json()) as { uploaded: { id: string }[] };
      assert.equal(data.uploaded.length, 1);
      createdDocIds.push(data.uploaded[0]!.id);
    });

    it("should reject multi-file upload that would exceed the 10-document limit", async () => {
      // Admin B currently has 1 active document.
      // Uploading 10 files in one request would bring total to 1 + 10 = 11 > 10.
      const formData = new FormData();
      for (let i = 0; i < 10; i++) {
        const blob = new Blob([`Batch file content ${i} - ${Date.now()}`], { type: "text/plain" });
        formData.append("file", blob, `batch-file-${i}-${Date.now()}.txt`);
      }

      const res = await fetch(`${baseUrl}/api/documents/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${limitAdminBToken}` },
        body: formData,
      });

      assert.equal(res.status, 400);
      const data = (await res.json()) as { error: string };
      assert.ok(data.error.includes("Upload exceeds maximum active document limit of 10"));
    });

    it("should prevent concurrent uploads from exceeding an individual admin's limit", async () => {
      const concurrentAdminId = crypto.randomUUID();
      const concurrentToken = jwt.sign(
        { sub: concurrentAdminId, role: ROLE_NAMES.ADMIN },
        JWT_SECRET
      );

      // Seed 9 active documents for concurrentAdmin
      const seedDocs = [];
      for (let i = 0; i < 9; i++) {
        seedDocs.push({
          filename: `concurrent-seed-${i}.txt`,
          fileType: "txt",
          filePath: `uploads/concurrent-seed-${i}.txt`,
          contentHash: crypto.randomBytes(16).toString("hex"),
          status: "ready",
          uploadedBy: concurrentAdminId,
        });
      }
      const inserted = await db.insert(documents).values(seedDocs).returning({ id: documents.id });
      createdDocIds.push(...inserted.map((d) => d.id));

      // Dispatch 2 concurrent upload requests (each attempting 1 file)
      const form1 = new FormData();
      form1.append("file", new Blob([`Concurrent file 1 - ${Date.now()}`], { type: "text/plain" }), `conc-1-${Date.now()}.txt`);

      const form2 = new FormData();
      form2.append("file", new Blob([`Concurrent file 2 - ${Date.now()}`], { type: "text/plain" }), `conc-2-${Date.now()}.txt`);

      const [res1, res2] = await Promise.all([
        fetch(`${baseUrl}/api/documents/upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${concurrentToken}` },
          body: form1,
        }),
        fetch(`${baseUrl}/api/documents/upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${concurrentToken}` },
          body: form2,
        }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      // Exactly one request must succeed (201) and the second must be rejected (400)
      assert.deepEqual(statuses, [201, 400]);

      // Query database to ensure exactly 10 active documents exist for this admin
      const activeDocs = await db
        .select()
        .from(documents)
        .where(eq(documents.uploadedBy, concurrentAdminId));
      assert.equal(activeDocs.length, 10);
      createdDocIds.push(...activeDocs.map((d) => d.id));
    });

    it("should release active document slot when an ingestion job transitions to failed", async () => {
      // Find one of Admin A's documents and mark it as 'failed'
      const [docToFail] = await db
        .select()
        .from(documents)
        .where(eq(documents.uploadedBy, limitAdminAId))
        .limit(1);

      assert.ok(docToFail);

      await db
        .update(documents)
        .set({ status: "failed" })
        .where(eq(documents.id, docToFail.id));

      // Admin A should now have 9 active documents (1 slot released)
      const blob = new Blob(["Upload after failed ingestion slot release"], { type: "text/plain" });
      const formData = new FormData();
      formData.append("file", blob, `slot-released-${Date.now()}.txt`);

      const res = await fetch(`${baseUrl}/api/documents/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${limitAdminAToken}` },
        body: formData,
      });

      assert.equal(res.status, 201);
      const data = (await res.json()) as { uploaded: { id: string }[] };
      assert.equal(data.uploaded.length, 1);
      createdDocIds.push(data.uploaded[0]!.id);
    });

    it("should release active document slot when an active document is deleted", async () => {
      // Admin A currently has 10 active documents again.
      // Find one active document and delete it via API
      const [docToDelete] = await db
        .select()
        .from(documents)
        .where(and(eq(documents.uploadedBy, limitAdminAId), eq(documents.status, "ready")))
        .limit(1);

      assert.ok(docToDelete);

      const deleteRes = await fetch(`${baseUrl}/api/documents/${docToDelete.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${limitAdminAToken}` },
      });
      assert.equal(deleteRes.status, 200);

      // Now upload 1 document into the released slot
      const blob = new Blob(["Upload after delete slot release"], { type: "text/plain" });
      const formData = new FormData();
      formData.append("file", blob, `delete-released-${Date.now()}.txt`);

      const uploadRes = await fetch(`${baseUrl}/api/documents/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${limitAdminAToken}` },
        body: formData,
      });

      assert.equal(uploadRes.status, 201);
      const data = (await uploadRes.json()) as { uploaded: { id: string }[] };
      assert.equal(data.uploaded.length, 1);
      createdDocIds.push(data.uploaded[0]!.id);
    });
  });
});
