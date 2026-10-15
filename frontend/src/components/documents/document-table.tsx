"use client";

import React, { useState } from "react";
import type { DocumentItem } from "@/types";
import { DocumentIcon, TrashIcon } from "@/components/ui/icons";
import { IngestionBadge } from "./ingestion-badge";

interface DocumentTableProps {
  documents: DocumentItem[];
  isLoading: boolean;
  canDelete: (doc: DocumentItem) => boolean;
  onDelete: (id: string) => Promise<boolean>;
}

export function DocumentTable({
  documents,
  isLoading,
  canDelete,
  onDelete,
}: DocumentTableProps) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="p-8 text-center text-xs text-zinc-500 bg-[#262626] rounded-2xl border border-zinc-800">
        Loading documents...
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="p-10 text-center bg-[#262626] rounded-2xl border border-zinc-800 flex flex-col items-center gap-2">
        <DocumentIcon className="w-8 h-8 text-zinc-500" />
        <p className="text-sm font-medium text-white">No documents uploaded yet</p>
        <p className="text-xs text-zinc-500">Upload documents to make them accessible for Q&A.</p>
      </div>
    );
  }

  const handleDelete = async (id: string) => {
    setIsDeleting(id);
    await onDelete(id);
    setIsDeleting(null);
    setConfirmId(null);
  };

  return (
    <div className="w-full overflow-x-auto bg-[#262626] border border-zinc-800 rounded-2xl">
      <table className="w-full text-left text-xs sm:text-sm">
        <thead className="text-[11px] uppercase text-zinc-400 border-b border-zinc-800 bg-zinc-900/40">
          <tr>
            <th className="py-3 px-4 sm:px-6">Document Name</th>
            <th className="py-3 px-4">Type</th>
            <th className="py-3 px-4">Status</th>
            <th className="py-3 px-4 hidden sm:table-cell">Uploaded</th>
            <th className="py-3 px-4 text-right pr-4 sm:pr-6">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/60">
          {documents.map((doc) => (
            <tr key={doc.id} className="hover:bg-zinc-800/30 transition-colors">
              <td className="py-3.5 px-4 sm:px-6 font-medium text-white max-w-xs truncate" title={doc.filename}>
                {doc.filename}
              </td>
              <td className="py-3.5 px-4 uppercase text-xs font-mono text-zinc-400">
                {doc.fileType}
              </td>
              <td className="py-3.5 px-4">
                <IngestionBadge
                  status={doc.status}
                  stage={doc.stage}
                  totalPages={doc.totalPages}
                  totalChunks={doc.totalChunks}
                  errorMessage={doc.errorMessage}
                />
                {doc.status === "failed" && doc.errorMessage && (
                  <p className="text-[10px] text-red-400 truncate max-w-[180px] mt-0.5" title={doc.errorMessage}>
                    {doc.errorMessage}
                  </p>
                )}
              </td>
              <td className="py-3.5 px-4 text-xs text-zinc-500 hidden sm:table-cell">
                {new Date(doc.createdAt).toLocaleDateString()}
              </td>
              <td className="py-3.5 px-4 text-right pr-4 sm:pr-6">
                {canDelete(doc) ? (
                  confirmId === doc.id ? (
                    <div className="flex items-center justify-end gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => handleDelete(doc.id)}
                        disabled={isDeleting === doc.id}
                        className="text-red-400 hover:text-red-300 font-medium"
                      >
                        {isDeleting === doc.id ? "Deleting..." : "Confirm"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        className="text-zinc-400 hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmId(doc.id)}
                      className="p-1 text-zinc-400 hover:text-red-400 transition-colors"
                      title="Delete document"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )
                ) : (
                  <span className="text-zinc-600">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
