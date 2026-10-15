import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "../database/client.js";
import { users, roles, ROLE_NAMES } from "../database/schema.js";
import { JWT_SECRET, JWT_EXPIRES_IN } from "../config/env.js";

const signOptions: jwt.SignOptions = {
  expiresIn: (JWT_EXPIRES_IN || "7d") as NonNullable<jwt.SignOptions["expiresIn"]>,
};

const createToken = (sub: string, role: string): string =>
  jwt.sign({ sub, role }, JWT_SECRET, signOptions);

export const registerUser = async (name: string, email: string, password: string) => {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) return { error: "conflict" as const };

  const [userRole] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.name, ROLE_NAMES.USER))
    .limit(1);

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db
    .insert(users)
    .values({ name, email, passwordHash, roleId: userRole!.id })
    .returning({ id: users.id, name: users.name, email: users.email });

  return {
    user: { ...user!, role: ROLE_NAMES.USER },
    token: createToken(user!.id, ROLE_NAMES.USER),
  };
};

export const loginUser = async (email: string, password: string) => {
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      passwordHash: users.passwordHash,
      role: roles.name,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.email, email))
    .limit(1);

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return null;
  }

  const { passwordHash: _, ...safeUser } = user;
  return {
    user: safeUser,
    token: createToken(user.id, user.role),
  };
};

export const getUserProfile = async (userId: string) => {
  const [user] = await db
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
    .where(eq(users.id, userId))
    .limit(1);

  return user ?? null;
};

export const updateUserProfile = async (userId: string, name: string) => {
  const trimmed = name.trim();
  const [updated] = await db
    .update(users)
    .set({ name: trimmed, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning({ id: users.id });

  if (!updated) return null;
  return getUserProfile(userId);
};

export const changeUserPassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: "notFound" | "invalidCurrentPassword" | "samePassword" }> => {
  const [user] = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return { success: false, error: "notFound" };

  const matches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!matches) return { success: false, error: "invalidCurrentPassword" };

  const isSame = await bcrypt.compare(newPassword, user.passwordHash);
  if (isSame) return { success: false, error: "samePassword" };

  const newHash = await bcrypt.hash(newPassword, 10);
  await db
    .update(users)
    .set({ passwordHash: newHash, updatedAt: new Date() })
    .where(eq(users.id, userId));

  return { success: true };
};
