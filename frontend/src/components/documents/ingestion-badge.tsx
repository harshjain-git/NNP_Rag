import React from "react";
import type { DocumentStatus, IngestionStage } from "@/types";

interface IngestionBadgeProps {
  status: DocumentStatus;
  stage?: IngestionStage;
  totalPages?: number;
  totalChunks?: number;
  errorMessage?: string;
}

export function IngestionBadge({
  status,
  stage,
  totalPages,
  totalChunks,
  errorMessage,
}: IngestionBadgeProps) {
  if (status === "processing") {
    let label = "Processing...";
    if (stage === "parsing") {
      label = "Parsing...";
    } else if (stage === "chunking") {
      label = totalPages ? `Chunking (${totalPages}p)...` : "Chunking...";
    } else if (stage === "embedding") {
      label = totalChunks ? `Embedding (${totalChunks}c)...` : "Embedding...";
    }

    return (
      <span
        title={label}
        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border bg-blue-950/60 text-blue-300 border-blue-800/60"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
        <span>{label}</span>
      </span>
    );
  }

  if (status === "ready") {
    const label = totalChunks ? `Ready (${totalChunks} chunks)` : "Ready";
    return (
      <span
        title={label}
        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border bg-emerald-950/60 text-emerald-300 border-emerald-800/60"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        <span>{label}</span>
      </span>
    );
  }

  if (status === "failed") {
    return (
      <span
        title={errorMessage || "Processing failed"}
        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border bg-red-950/60 text-red-300 border-red-800/60 cursor-help"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
        <span>Failed</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border bg-zinc-800 text-zinc-300 border-zinc-700">
      <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
      <span>Uploaded</span>
    </span>
  );
}
