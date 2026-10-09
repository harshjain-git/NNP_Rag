import { db, pool } from "./client.js";
import { roles, ROLE_NAMES } from "./schema.js";

export const DEFAULT_ROLES = [
  {
    name: ROLE_NAMES.USER,
    description: "Standard document knowledge consumer",
  },
  {
    name: ROLE_NAMES.ADMIN,
    description: "Knowledge and prompt administrator",
  },
  {
    name: ROLE_NAMES.SUPER_ADMIN,
    description: "System administrator with full administrative access",
  },
] as const;

/**
 * Seeds default canonical roles idempotently.
 * Uses ON CONFLICT (name) DO NOTHING to ensure repeatability without duplicate key violations.
 */
export const seedRoles = async () => {
  const result = await db
    .insert(roles)
    .values(DEFAULT_ROLES.map((r) => ({ name: r.name, description: r.description })))
    .onConflictDoNothing({ target: roles.name })
    .returning();

  return result;
};

// Executable entrypoint when invoked directly via tsx (e.g., npm run db:seed)
const run = async () => {
  try {
    console.log("Seeding canonical roles into PostgreSQL...");
    const inserted = await seedRoles();
    console.log(`Roles seed complete. Newly inserted roles: ${inserted.length}`);
    for (const r of inserted) {
      console.log(` - [${r.name}] id: ${r.id}`);
    }
  } catch (err) {
    console.error("Failed to seed roles:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

if (process.argv[1]?.endsWith("seed.ts") || process.argv[1]?.endsWith("seed.js")) {
  void run();
}
