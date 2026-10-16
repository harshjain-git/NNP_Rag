"use client";

import React, { useState } from "react";
import type { Prompt } from "@/types";
import { EditIcon, TrashIcon, ShieldIcon } from "@/components/ui/icons";

interface PromptListProps {
  prompts: Prompt[];
  isLoading: boolean;
  onEdit: (prompt: Prompt) => void;
  onToggleStatus: (prompt: Prompt) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onCreateNew: () => void;
}

export function PromptList({
  prompts,
  isLoading,
  onEdit,
  onToggleStatus,
  onDelete,
  onCreateNew,
}: PromptListProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="p-8 text-center text-xs text-zinc-500 bg-[#262626] rounded-2xl border border-zinc-800">
        Loading prompts...
      </div>
    );
  }

  if (prompts.length === 0) {
    return (
      <div className="p-10 text-center bg-[#262626] rounded-2xl border border-zinc-800 flex flex-col items-center gap-2">
        <ShieldIcon className="w-8 h-8 text-zinc-500" />
        <p className="text-sm font-medium text-white">No prompt templates found</p>
        <p className="text-xs text-zinc-400 max-w-sm mb-2">
          Create system prompt templates to configure grounding, persona, and synthesis.
        </p>
        <button
          type="button"
          onClick={onCreateNew}
          className="px-4 py-1.5 rounded-full bg-white text-black text-xs font-medium hover:bg-zinc-200 transition-colors"
        >
          Create First Prompt
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {prompts.map((prompt) => {
        const isActive = prompt.status === "active";
        const isConfirming = confirmDeleteId === prompt.id;

        return (
          <div
            key={prompt.id}
            className="p-5 rounded-2xl bg-[#262626] border border-zinc-800 space-y-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-sm font-semibold text-white">{prompt.name}</span>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700">
                  System Prompt
                </span>
                <button
                  type="button"
                  onClick={() => onToggleStatus(prompt)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                    isActive
                      ? "bg-emerald-950/60 text-emerald-300 border-emerald-800/60"
                      : "bg-zinc-800 text-zinc-400 border-zinc-700"
                  }`}
                  title="Click to toggle status"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-400" : "bg-zinc-500"}`} />
                  {isActive ? "Active" : "Draft"}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onEdit(prompt)}
                  className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                  title="Edit prompt"
                >
                  <EditIcon className="w-4 h-4" />
                </button>

                {isConfirming ? (
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        onDelete(prompt.id);
                        setConfirmDeleteId(null);
                      }}
                      className="text-red-400 hover:text-red-300 font-medium"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-zinc-400 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(prompt.id)}
                    className="p-1.5 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                    title="Delete prompt"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <pre className="p-3.5 rounded-xl bg-[#2f2f2f] border border-zinc-700/40 text-xs font-mono text-zinc-300 max-h-32 overflow-y-auto whitespace-pre-wrap">
              {prompt.content}
            </pre>

            <div className="flex items-center justify-between text-[11px] text-zinc-500">
              <span>Updated: {new Date(prompt.updatedAt || prompt.createdAt).toLocaleDateString()}</span>
              <span className="font-mono text-[10px]">ID: {prompt.id.slice(0, 8)}...</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
