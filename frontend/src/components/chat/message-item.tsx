"use client";

import React, { useState } from "react";
import type { Message, Citation } from "@/types";
import { DocumentIcon } from "@/components/ui/icons";

interface MessageItemProps {
  message: Message;
}

export function MessageItem({ message }: MessageItemProps) {
  const isUser = message.role === "user";
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const toggleCitation = (idx: number) => {
    setExpandedIndex((prev) => (prev === idx ? null : idx));
  };

  if (isUser) {
    return (
      <div className="flex justify-end w-full">
        <div className="max-w-[85%] sm:max-w-[75%] rounded-3xl bg-[#2f2f2f] text-zinc-100 px-4 py-3 text-sm sm:text-base leading-relaxed whitespace-pre-wrap break-words border border-zinc-700/40 shadow-xs">
          {message.content}
        </div>
      </div>
    );
  }

  const citations: Citation[] = message.citations || [];

  return (
    <div className="flex flex-col w-full text-zinc-100 space-y-3">
      {/* Assistant Message Content */}
      <div className="text-sm sm:text-base text-zinc-200 leading-relaxed whitespace-pre-wrap break-words px-1">
        {message.content}
      </div>

      {/* Citations Section */}
      {citations.length > 0 && (
        <div className="mt-3 pt-3 border-t border-zinc-800/80 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-zinc-400">
            <DocumentIcon className="w-3.5 h-3.5 text-zinc-400" />
            <span>Sources ({citations.length})</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {citations.map((citation, idx) => {
              const isExpanded = expandedIndex === idx;
              return (
                <div
                  key={`${citation.chunkId}-${idx}`}
                  className="rounded-2xl bg-[#262626]/90 border border-zinc-800 hover:border-zinc-700/80 p-3 transition-colors text-xs"
                >
                  <button
                    type="button"
                    onClick={() => toggleCitation(idx)}
                    className="w-full flex items-center justify-between text-left gap-2 focus:outline-hidden"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <DocumentIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span className="font-medium text-zinc-200 truncate">
                        {citation.filename}
                      </span>
                    </div>
                    {citation.pageNumber !== null && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 shrink-0">
                        p. {citation.pageNumber}
                      </span>
                    )}
                  </button>

                  {/* Expandable Snippet Preview */}
                  {citation.snippet && (
                    <div
                      className={`mt-2 text-zinc-400 text-[11px] leading-relaxed border-t border-zinc-800/70 pt-2 ${
                        isExpanded ? "whitespace-pre-wrap" : "line-clamp-2 cursor-pointer"
                      }`}
                      onClick={() => toggleCitation(idx)}
                    >
                      {citation.snippet}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
