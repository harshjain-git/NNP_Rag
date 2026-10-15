"use client";

import React from "react";
import type { Citation } from "@/types";
import { DocumentIcon } from "@/components/ui/icons";

interface CitationBadgeProps {
  citation: Citation;
  index: number;
  onClick: () => void;
  isActive?: boolean;
}

export function CitationBadge({
  citation,
  index,
  onClick,
  isActive = false,
}: CitationBadgeProps) {
  const pageLabel =
    citation.pageNumber !== null && citation.pageNumber !== undefined
      ? `p. ${citation.pageNumber}`
      : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer text-left max-w-full ${
        isActive
          ? "bg-blue-950/60 border-blue-500/80 text-blue-200 shadow-xs"
          : "bg-[#262626] hover:bg-zinc-800 border-zinc-700/70 text-zinc-300 hover:text-white"
      }`}
      title={`Inspect source: ${citation.filename}${pageLabel ? ` (${pageLabel})` : ""}`}
    >
      <span className="flex items-center justify-center w-4 h-4 rounded-full bg-zinc-800 text-[10px] text-zinc-400 group-hover:text-zinc-200 shrink-0 font-mono">
        {index}
      </span>
      <DocumentIcon className="w-3.5 h-3.5 text-zinc-400 group-hover:text-blue-400 shrink-0 transition-colors" />
      <span className="truncate max-w-[140px] sm:max-w-[180px]">
        {citation.filename}
      </span>
      {pageLabel && (
        <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-zinc-800/80 text-zinc-400 shrink-0">
          {pageLabel}
        </span>
      )}
    </button>
  );
}
