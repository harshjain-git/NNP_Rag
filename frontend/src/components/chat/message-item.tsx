"use client";

import React from "react";
import type { Message, Citation } from "@/types";
import { DocumentIcon } from "@/components/ui/icons";
import { CitationBadge } from "./citation-badge";

interface MessageItemProps {
  message: Message;
  onSelectCitation?: (citation: Citation) => void;
  activeCitationId?: string | null;
}

export function MessageItem({
  message,
  onSelectCitation,
  activeCitationId,
}: MessageItemProps) {
  const isUser = message.role === "user";

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
  const isInsufficientEvidence =
    message.content.toLowerCase().includes("could not find sufficient evidence") ||
    message.content.startsWith("INSUFFICIENT_EVIDENCE:");

  return (
    <div className="flex flex-col w-full text-zinc-100 space-y-3">
      {/* Insufficient Evidence Warning Banner */}
      {isInsufficientEvidence && (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-950/40 text-amber-300 border border-amber-800/60 w-fit">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <span>Insufficient Evidence • Grounding Safeguard Triggered</span>
        </div>
      )}

      {/* Assistant Answer Body */}
      <div className="text-sm sm:text-base text-zinc-200 leading-relaxed whitespace-pre-wrap break-words px-1">
        {message.content}
      </div>

      {/* Verified Sources / Citations Section */}
      {citations.length > 0 && (
        <div className="mt-3 pt-3 border-t border-zinc-800/80 space-y-2.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            <DocumentIcon className="w-3.5 h-3.5 text-blue-400" />
            <span>Sources ({citations.length})</span>
            <span className="text-[10px] text-zinc-500 font-normal lowercase">
              • click to inspect excerpt
            </span>
          </div>

          <div className="flex flex-wrap gap-2 pt-0.5">
            {citations.map((citation, idx) => (
              <CitationBadge
                key={`${citation.chunkId}-${idx}`}
                citation={citation}
                index={idx + 1}
                onClick={() => onSelectCitation?.(citation)}
                isActive={activeCitationId === citation.chunkId}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
