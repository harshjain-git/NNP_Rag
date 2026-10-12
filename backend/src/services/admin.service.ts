import bcrypt from "bcrypt";
import { eq, desc } from "drizzle-orm";
import { db } from "../database/client.js";
import { users, roles, ROLE_NAMES, type RoleName } from "../database/schema.js";

const getRoleByName = async (name: RoleName) => {
  const [role] = await db.select().from(roles).where(eq(roles.name, name)).limit(1);
  return role;
};

export const listUsers = async () =>
  db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: roles.name,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .orderBy(desc(users.createdAt));

export const updateUserRole = async (
  requesterId: string,
  targetUserId: string,
  newRole: RoleName
) => {
  if (requesterId === targetUserId && newRole !== ROLE_NAMES.SUPER_ADMIN) {
    return { error: "selfDemotion" as const };
  }

  const [targetUser] = await db
    .select({ id: users.id, name: users.name, email: users.email, role: roles.name })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.id, targetUserId))
    .limit(1);

  if (!targetUser) return { error: "notFound" as const };

  const newRoleRecord = await getRoleByName(newRole);
  if (!newRoleRecord) return { error: "invalidRole" as const };

  if (targetUser.role === ROLE_NAMES.SUPER_ADMIN && newRole !== ROLE_NAMES.SUPER_ADMIN) {
    const superAdmins = await db
      .select({ id: users.id })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(eq(roles.name, ROLE_NAMES.SUPER_ADMIN));
    if (superAdmins.length <= 1) return { error: "lastSuperAdmin" as const };
  }

  const [updated] = await db
    .update(users)
    .set({ roleId: newRoleRecord.id, updatedAt: new Date() })
    .where(eq(users.id, targetUserId))
    .returning({ id: users.id, name: users.name, email: users.email, updatedAt: users.updatedAt });

  return { user: { ...updated!, role: newRole } };
};

export const createAdminUser = async (
  name: string,
  email: string,
  password: string,
  role: RoleName
) => {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) return { error: "conflict" as const };

  const roleRecord = await getRoleByName(role);
  if (!roleRecord) return { error: "invalidRole" as const };

  const passwordHash = await bcrypt.hash(password, 10);
  const [newUser] = await db
    .insert(users)
    .values({ name, email, passwordHash, roleId: roleRecord.id })
    .returning({ id: users.id, name: users.name, email: users.email, createdAt: users.createdAt });

  return { user: { ...newUser!, role } };
};
