import express from "express";
import cors from "cors";
import { CORS_ORIGIN } from "./config/env.js";
import documentsRoutes from "./routes/documents.routes.js";
import chatRoutes from "./routes/chat.routes.js";

const app = express();

app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    message: "NNT RAG Backend is running",
  });
});

app.use("/api/documents", documentsRoutes);
app.use("/api/chat", chatRoutes);

export default app;