// import app from "./app.js";

// const PORT = 3000;

// app.listen(PORT, () => {
//     console.log(`Server running on http://localhost:${PORT}`);
// });

import app from "./app.js";
import { pool } from "./database/client.js";

const PORT = 3000;

const startServer = async () => {
    try {
        await pool.query("SELECT 1");

        console.log("Database connected successfully");

        const result = await pool.query(`
  SELECT
    current_database() AS database,
    current_user AS user,
    version() AS version
`);

        console.log("Database:", result.rows[0].database);
        console.log("User:", result.rows[0].user);
        console.log("PostgreSQL:", result.rows[0].version);

        const vectorResult = await pool.query(`
  SELECT extname, extversion
  FROM pg_extension
  WHERE extname = 'vector'
`);

        console.log("Vector extension:", vectorResult.rows[0]);

        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("Database connection failed:", error);
        process.exit(1);
    }
};

startServer();