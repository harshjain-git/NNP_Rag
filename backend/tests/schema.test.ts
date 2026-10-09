import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getTableName } from "drizzle-orm";
import {
  ROLE_NAMES,
  roles,
  users,
  documents,
  documentChunks,
} from "../src/database/schema.js";
import { DEFAULT_ROLES } from "../src/database/seed.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..");
const drizzleDir = path.join(backendRoot, "drizzle");

describe("Database Schema Foundation (Auth & RBAC)", () => {
  it("should define consistent canonical role values", () => {
    assert.equal(ROLE_NAMES.USER, "USER");
    assert.equal(ROLE_NAMES.ADMIN, "ADMIN");
    assert.equal(ROLE_NAMES.SUPER_ADMIN, "SUPER_ADMIN");
  });

  it("should configure DEFAULT_ROLES seeding data for all canonical roles", () => {
    assert.equal(DEFAULT_ROLES.length, 3);
    const names = DEFAULT_ROLES.map((r) => r.name);
    assert.ok(names.includes(ROLE_NAMES.USER));
    assert.ok(names.includes(ROLE_NAMES.ADMIN));
    assert.ok(names.includes(ROLE_NAMES.SUPER_ADMIN));
    for (const r of DEFAULT_ROLES) {
      assert.ok(r.description && r.description.length > 0);
    }
  });

  it("should configure the roles table with expected columns and table name", () => {
    assert.equal(getTableName(roles), "roles");
    assert.equal(roles.id.name, "id");
    assert.equal(roles.id.primary, true);
    assert.equal(roles.name.name, "name");
    assert.equal(roles.name.isUnique, true);
    assert.equal(roles.description.name, "description");
    assert.equal(roles.createdAt.name, "created_at");
  });

  it("should configure the users table with expected columns, foreign keys, and indexes", () => {
    assert.equal(getTableName(users), "users");
    assert.equal(users.id.name, "id");
    assert.equal(users.id.primary, true);
    assert.equal(users.name.name, "name");
    assert.equal(users.email.name, "email");
    assert.equal(users.email.isUnique, true);
    assert.equal(users.passwordHash.name, "password_hash");
    assert.equal(users.roleId.name, "role_id");
    assert.equal(users.createdAt.name, "created_at");
    assert.equal(users.updatedAt.name, "updated_at");
  });

  it("should preserve existing documents and chunks schema", () => {
    assert.equal(getTableName(documents), "documents");
    assert.equal(getTableName(documentChunks), "document_chunks");
    assert.ok(documents.id);
    assert.ok(documents.uploadedBy);
    assert.ok(documents.contentHash);
    assert.ok(documentChunks.embedding);
  });

  it("should verify migration SQL file contains required DDL, constraints, defaults, and indexes", () => {
    const migrationPath = path.join(drizzleDir, "0001_perfect_post.sql");
    assert.ok(fs.existsSync(migrationPath), "Migration 0001_perfect_post.sql must exist");

    const sqlContent = fs.readFileSync(migrationPath, "utf-8");

    // Roles table assertions
    assert.ok(sqlContent.includes('CREATE TABLE "roles"'), "Must create roles table");
    assert.ok(
      sqlContent.includes('"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL'),
      "Roles id must use gen_random_uuid() default and be primary key"
    );
    assert.ok(
      sqlContent.includes('CONSTRAINT "roles_name_unique" UNIQUE("name")'),
      "Roles name must have a unique constraint"
    );
    assert.ok(
      sqlContent.includes('"created_at" timestamp with time zone DEFAULT now() NOT NULL'),
      "Roles created_at must have timezone and now() default"
    );

    // Users table assertions
    assert.ok(sqlContent.includes('CREATE TABLE "users"'), "Must create users table");
    assert.ok(
      sqlContent.includes('CONSTRAINT "users_email_unique" UNIQUE("email")'),
      "Users email must have a unique constraint"
    );
    assert.ok(
      sqlContent.includes('"password_hash" text NOT NULL'),
      "Users password_hash must be present and not null"
    );
    assert.ok(
      sqlContent.includes('"role_id" uuid NOT NULL'),
      "Users role_id must be present and not null"
    );

    // Foreign key constraint
    assert.ok(
      sqlContent.includes(
        'ALTER TABLE "users" ADD CONSTRAINT "users_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id")'
      ),
      "Users role_id must reference roles id with foreign key constraint"
    );

    // Indexes
    assert.ok(
      sqlContent.includes('CREATE INDEX "idx_users_email" ON "users" USING btree ("email")'),
      "Must create btree index on users(email)"
    );
    assert.ok(
      sqlContent.includes('CREATE INDEX "idx_users_role_id" ON "users" USING btree ("role_id")'),
      "Must create btree index on users(role_id)"
    );
  });

  it("should verify Drizzle migration journal and snapshots are synchronized", () => {
    const journalPath = path.join(drizzleDir, "meta", "_journal.json");
    assert.ok(fs.existsSync(journalPath), "Migration _journal.json must exist");

    const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));
    assert.equal(journal.dialect, "postgresql");
    assert.equal(journal.entries.length, 2);

    const initialEntry = journal.entries[0];
    assert.equal(initialEntry.idx, 0);
    assert.equal(initialEntry.tag, "0000_curious_elektra");

    const authEntry = journal.entries[1];
    assert.equal(authEntry.idx, 1);
    assert.equal(authEntry.tag, "0001_perfect_post");

    const snapshotPath = path.join(drizzleDir, "meta", "0001_snapshot.json");
    assert.ok(fs.existsSync(snapshotPath), "0001_snapshot.json snapshot must exist");

    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf-8"));
    const rolesTable = snapshot.tables?.["public.roles"];
    const usersTable = snapshot.tables?.["public.users"];

    assert.ok(rolesTable, "Snapshot must include public.roles table");
    assert.equal(rolesTable.columns?.name?.notNull, true);
    assert.ok(rolesTable.uniqueConstraints?.roles_name_unique);

    assert.ok(usersTable, "Snapshot must include public.users table");
    assert.equal(usersTable.columns?.email?.notNull, true);
    assert.ok(usersTable.uniqueConstraints?.users_email_unique);
    assert.ok(usersTable.foreignKeys?.users_role_id_roles_id_fk);
    assert.ok(usersTable.indexes?.idx_users_email);
    assert.ok(usersTable.indexes?.idx_users_role_id);
  });
});
