"use client";

import React from "react";
import Link from "next/link";
import { DocumentIcon, ArrowUpIcon } from "@/components/ui/icons";

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export function Composer({
  value,
  onChange,
  onSubmit,
  disabled = false,
}: ComposerProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim() && !disabled) {
      onSubmit();
    }
  };

  return (
    <div className="w-full max-w-3xl mt-4">
      <form
        onSubmit={handleSubmit}
        className="relative rounded-3xl bg-[#2a2a2a] border border-zinc-700/80 focus-within:border-zinc-500 focus-within:ring-1 focus-within:ring-zinc-500 transition-all p-3 shadow-lg"
      >
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Message NNT_Rag or ask about your documents..."
          rows={2}
          disabled={disabled}
          className="w-full bg-transparent text-white placeholder-zinc-500 text-sm sm:text-base resize-none focus:outline-none px-2 py-1 leading-relaxed disabled:opacity-50"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />

        <div className="flex items-center justify-between pt-1 px-1">
          <Link
            href="/documents"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 py-1 px-2.5 rounded-full hover:bg-zinc-800 transition-colors"
          >
            <DocumentIcon className="w-3.5 h-3.5" />
            <span>Ground with documents</span>
          </Link>

          <button
            type="submit"
            disabled={!value.trim() || disabled}
            aria-label="Send message"
            className="p-2 rounded-full bg-white text-black disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed hover:bg-zinc-200 transition-colors"
          >
            <ArrowUpIcon className="w-4 h-4" />
          </button>
        </div>
      </form>

      <p className="text-center text-[11px] text-zinc-500 mt-2.5">
        NNT_Rag answers are grounded in your uploaded documents. Verify important citations.
      </p>
    </div>
  );
}
