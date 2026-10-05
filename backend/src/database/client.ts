import pg from "pg";
import { DATABASE_URL } from "../config/env.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: DATABASE_URL,
});