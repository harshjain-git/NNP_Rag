import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { DATABASE_URL } from "../config/env.js";
import * as schema from "./schema.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: DATABASE_URL,
});

export const db = drizzle(pool, { schema });