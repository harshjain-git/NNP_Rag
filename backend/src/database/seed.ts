import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { db, pool } from "./client.js";
import { roles, users, ROLE_NAMES } from "./schema.js";
import {
  SUPER_ADMIN_NAME,
  SUPER_ADMIN_EMAIL,
  SUPER_ADMIN_PASSWORD,
} from "../config/env.js";

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

export interface SeedSuperAdminOptions {
  name?: string;
  email?: string;
  password?: string;
}

export interface SeedSuperAdminResult {
  user: { id: string; name: string; email: string };
  created: boolean;
  elevated: boolean;
}

/**
 * Seeds the initial Super Admin user idempotently.
 * 1. Ensures canonical roles exist.
 * 2. Checks if a user with target email already exists.
 *    - If exists and not SUPER_ADMIN, elevates role to SUPER_ADMIN.
 *    - If exists and already SUPER_ADMIN, leaves untouched.
 *    - If does not exist, hashes password with bcrypt (10 rounds) and inserts new user.
 */
export const seedSuperAdmin = async (
  options?: SeedSuperAdminOptions
): Promise<SeedSuperAdminResult> => {
  // Ensure roles are seeded first
  await seedRoles();

  const [superAdminRole] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.name, ROLE_NAMES.SUPER_ADMIN))
    .limit(1);

  if (!superAdminRole) {
    throw new Error("SUPER_ADMIN role not found in database");
  }

  const name = options?.name || SUPER_ADMIN_NAME;
  const email = (options?.email || SUPER_ADMIN_EMAIL).trim().toLowerCase();
  const password = options?.password || SUPER_ADMIN_PASSWORD;

  const [existingUser] = await db
    .select({ id: users.id, name: users.name, email: users.email, roleId: users.roleId })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser) {
    const passwordHash = await bcrypt.hash(password, 10);
    const wasElevated = existingUser.roleId !== superAdminRole.id;

    const [updated] = await db
      .update(users)
      .set({
        name,
        passwordHash,
        roleId: superAdminRole.id,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existingUser.id))
      .returning({ id: users.id, name: users.name, email: users.email });

    return {
      user: updated ?? { id: existingUser.id, name: existingUser.name, email: existingUser.email },
      created: false,
      elevated: wasElevated,
    };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [newUser] = await db
    .insert(users)
    .values({
      name,
      email,
      passwordHash,
      roleId: superAdminRole.id,
    })
    .returning({ id: users.id, name: users.name, email: users.email });

  return { user: newUser!, created: true, elevated: false };
};

/**
 * Complete database seed orchestrator.
 */
export const seedDatabase = async () => {
  const insertedRoles = await seedRoles();
  const superAdminResult = await seedSuperAdmin();
  return {
    roles: insertedRoles,
    superAdmin: superAdminResult,
  };
};

// Executable entrypoint when invoked directly via tsx (e.g., npm run db:seed)
const run = async () => {
  try {
    console.log("Seeding canonical roles into PostgreSQL...");
    const { roles: insertedRoles, superAdmin } = await seedDatabase();
    console.log(`Roles seed complete. Newly inserted roles: ${insertedRoles.length}`);
    for (const r of insertedRoles) {
      console.log(` - [${r.name}] id: ${r.id}`);
    }

    if (superAdmin.created) {
      console.log(`Super Admin user created successfully:`);
      console.log(` - Name: ${superAdmin.user.name}`);
      console.log(` - Email: ${superAdmin.user.email}`);
      console.log(` - Role: ${ROLE_NAMES.SUPER_ADMIN}`);
    } else if (superAdmin.elevated) {
      console.log(`Existing user elevated to Super Admin:`);
      console.log(` - Name: ${superAdmin.user.name}`);
      console.log(` - Email: ${superAdmin.user.email}`);
      console.log(` - Role: ${ROLE_NAMES.SUPER_ADMIN}`);
    } else {
      console.log(`Super Admin already exists: ${superAdmin.user.email} (${ROLE_NAMES.SUPER_ADMIN})`);
    }
  } catch (err) {
    console.error("Failed to seed database:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

if (process.argv[1]?.endsWith("seed.ts") || process.argv[1]?.endsWith("seed.js")) {
  void run();
}
