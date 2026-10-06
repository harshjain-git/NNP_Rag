import express from "express";
import documentsRoutes from "./routes/documents.routes.js";

const app = express();

app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    message: "NNT RAG Backend is running",
  });
});

app.use("/api/documents", documentsRoutes);

export default app;