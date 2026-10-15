"use client";

import React, { useEffect } from "react";
import type { Citation } from "@/types";
import { DocumentIcon, CloseIcon } from "@/components/ui/icons";

interface CitationDrawerProps {
  citation: Citation | null;
  isOpen: boolean;
  onClose: () => void;
}

export function CitationDrawer({ citation, isOpen, onClose }: CitationDrawerProps) {
  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !citation) return null;

  const similarityPercentage =
    citation.similarity !== undefined && citation.similarity !== null
      ? citation.similarity <= 1
        ? `${Math.round(citation.similarity * 100)}% Match`
        : `${citation.similarity.toFixed(2)} Score`
      : null;

  return (
    <>
      {/* Backdrop */}
      <div
        role="presentation"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity"
      />

      {/* Slide-over Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Source Inspector"
        className="fixed inset-y-0 right-0 z-50 w-full sm:w-[440px] bg-[#171717] border-l border-zinc-800 shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800/80">
          <div className="flex items-center gap-2">
            <DocumentIcon className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-white">Source Inspector</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Close inspector"
            aria-label="Close inspector"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Document Overview Card */}
          <div className="p-4 rounded-2xl bg-[#262626] border border-zinc-800 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Document
                </span>
                <p className="text-sm font-medium text-white truncate" title={citation.filename}>
                  {citation.filename}
                </p>
              </div>
              {similarityPercentage && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-950/80 text-blue-300 border border-blue-800/60 shrink-0 font-medium">
                  {similarityPercentage}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-zinc-400 pt-1 border-t border-zinc-800">
              <span>
                Location:{" "}
                <strong className="text-zinc-200">
                  {citation.pageNumber !== null && citation.pageNumber !== undefined
                    ? `Page ${citation.pageNumber}`
                    : "Full document"}
                </strong>
              </span>
              <span>•</span>
              <span>
                Chunk Index:{" "}
                <strong className="text-zinc-200">
                  {citation.chunkIndex !== undefined && citation.chunkIndex !== null
                    ? `#${citation.chunkIndex + 1}`
                    : "—"}
                </strong>
              </span>
            </div>
          </div>

          {/* Excerpt Snippet */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="font-semibold uppercase tracking-wider text-[10px]">
                Retrieved Context Snippet
              </span>
              <span className="text-[11px] text-zinc-500">Verified Evidence</span>
            </div>

            <div className="p-4 rounded-2xl bg-[#262626]/80 border border-zinc-800/90 text-xs sm:text-sm text-zinc-200 leading-relaxed font-mono whitespace-pre-wrap max-h-[380px] overflow-y-auto select-text">
              {citation.snippet || "No text snippet available for this citation."}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800/80 bg-zinc-900/30 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 transition-colors"
          >
            Done
          </button>
        </div>
      </aside>
    </>
  );
}
