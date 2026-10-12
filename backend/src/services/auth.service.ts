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
