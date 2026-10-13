import bcrypt from "bcrypt";
import { eq, desc } from "drizzle-orm";
import { db } from "../database/client.js";
import { users, roles, ROLE_NAMES, type RoleName } from "../database/schema.js";

export interface SafeAdminUser {
  id: string;
  name: string;
  email: string;
  role: RoleName;
  createdAt?: Date;
  updatedAt?: Date;
}

export type AdminOperationResult<E extends string> =
  | { user: SafeAdminUser }
  | { error: E };

const getRoleByName = async (name: RoleName) => {
  const [role] = await db.select().from(roles).where(eq(roles.name, name)).limit(1);
  return role;
};

const getUserWithRole = async (userId: string) => {
  const [user] = await db
    .select({ id: users.id, name: users.name, email: users.email, role: roles.name })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.id, userId))
    .limit(1);
  return user;
};

const isLastSuperAdmin = async (): Promise<boolean> => {
  const superAdmins = await db
    .select({ id: users.id })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(roles.name, ROLE_NAMES.SUPER_ADMIN));
  return superAdmins.length <= 1;
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
): Promise<AdminOperationResult<"selfDemotion" | "notFound" | "invalidRole" | "lastSuperAdmin">> => {
  if (requesterId === targetUserId && newRole !== ROLE_NAMES.SUPER_ADMIN) {
    return { error: "selfDemotion" };
  }

  const targetUser = await getUserWithRole(targetUserId);
  if (!targetUser) return { error: "notFound" };

  const newRoleRecord = await getRoleByName(newRole);
  if (!newRoleRecord) return { error: "invalidRole" };

  if (targetUser.role === ROLE_NAMES.SUPER_ADMIN && newRole !== ROLE_NAMES.SUPER_ADMIN && (await isLastSuperAdmin())) {
    return { error: "lastSuperAdmin" };
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
): Promise<AdminOperationResult<"conflict" | "invalidRole">> => {
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) return { error: "conflict" };

  const roleRecord = await getRoleByName(role);
  if (!roleRecord) return { error: "invalidRole" };

  const passwordHash = await bcrypt.hash(password, 10);
  const [newUser] = await db
    .insert(users)
    .values({ name, email, passwordHash, roleId: roleRecord.id })
    .returning({ id: users.id, name: users.name, email: users.email, createdAt: users.createdAt });

  return { user: { ...newUser!, role } };
};

export const deleteUser = async (
  requesterId: string,
  targetUserId: string
): Promise<AdminOperationResult<"selfDeletion" | "notFound" | "lastSuperAdmin">> => {
  if (requesterId === targetUserId) return { error: "selfDeletion" };

  const targetUser = await getUserWithRole(targetUserId);
  if (!targetUser) return { error: "notFound" };

  if (targetUser.role === ROLE_NAMES.SUPER_ADMIN && (await isLastSuperAdmin())) {
    return { error: "lastSuperAdmin" };
  }

  const [deleted] = await db
    .delete(users)
    .where(eq(users.id, targetUserId))
    .returning({ id: users.id, name: users.name, email: users.email });

  return { user: { ...deleted!, role: targetUser.role as RoleName } };
};

