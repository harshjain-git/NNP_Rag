"use client";

import React, { useState } from "react";
import type { Prompt, PromptType, PromptStatus, CreatePromptPayload, UpdatePromptPayload } from "@/types";
import { CloseIcon } from "@/components/ui/icons";

interface PromptFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: CreatePromptPayload | UpdatePromptPayload) => Promise<boolean>;
  initialData?: Prompt | null;
}

export function PromptFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
}: PromptFormModalProps) {
  if (!isOpen) return null;

  return (
    <PromptFormContent
      key={initialData?.id || "new"}
      initialData={initialData}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}

function PromptFormContent({
  initialData,
  onClose,
  onSubmit,
}: Omit<PromptFormModalProps, "isOpen">) {
  const [name, setName] = useState(initialData?.name || "");
  const [content, setContent] = useState(initialData?.content || "");
  const type: PromptType = "system";
  const [status, setStatus] = useState<PromptStatus>(initialData?.status || "active");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Prompt name is required.");
    if (!content.trim()) return setError("Prompt content is required.");

    setIsSubmitting(true);
    const ok = await onSubmit({
      name: name.trim(),
      content: content.trim(),
      type,
      status,
    });
    setIsSubmitting(false);
    if (ok) onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
    >
      <div className="w-full max-w-2xl bg-[#262626] border border-zinc-700/80 rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
          <h2 className="text-base font-semibold text-white">
            {initialData ? "Edit Prompt Template" : "Create Prompt Template"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="px-3.5 py-2 rounded-xl bg-red-950/40 border border-red-800/60 text-red-200 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">Prompt Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Default System Prompt"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#2f2f2f] border border-zinc-700/80 text-sm text-white placeholder-zinc-500 focus:outline-hidden focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">Type</label>
              <input
                type="text"
                value="System Prompt"
                disabled
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#222] border border-zinc-800 text-sm text-zinc-400 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as PromptStatus)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#2f2f2f] border border-zinc-700/80 text-sm text-white focus:outline-hidden focus:border-blue-500"
              >
                <option value="active">Active</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">Prompt Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={7}
              placeholder="Enter system prompt instructions and constraints..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#2f2f2f] border border-zinc-700/80 text-xs sm:text-sm font-mono text-white placeholder-zinc-500 focus:outline-hidden focus:border-blue-500 resize-y leading-relaxed"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-full text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-full text-xs font-medium text-black bg-white hover:bg-zinc-200 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? "Saving..." : initialData ? "Save Changes" : "Create Prompt"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
