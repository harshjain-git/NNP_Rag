import app from "./app.js";
import { db, pool } from "./database/client.js";
import { sql } from "drizzle-orm";

const PORT = Number(process.env.PORT) || 3000;

const startServer = async (): Promise<void> => {
  try {
    await pool.query("SELECT 1");
    await db.execute(sql`SELECT 1`);
    console.log("Database connected successfully (pg + Drizzle)");

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Database connection failed:", error);
    process.exit(1);
  }
};

startServer();