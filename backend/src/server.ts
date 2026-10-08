import http from "node:http";
import app from "./app.js";
import { db, pool } from "./database/client.js";
import { sql } from "drizzle-orm";
import { PORT } from "./config/env.js";
import { initRealtimeServer } from "./realtime/index.js";

export const server = http.createServer(app);
initRealtimeServer(server, "/ws");

export const startServer = async (): Promise<void> => {
  try {
    await pool.query("SELECT 1");
    await db.execute(sql`SELECT 1`);
    console.log("Database connected successfully (pg + Drizzle)");

    server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`WebSocket server running on ws://localhost:${PORT}/ws`);
    });
  } catch (error) {
    console.error("Database connection failed:", error);
    process.exit(1);
  }
};

startServer();