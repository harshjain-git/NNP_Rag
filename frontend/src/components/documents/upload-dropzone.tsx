"use client";

import React, { useState, useRef } from "react";
import { UploadIcon, CloseIcon } from "@/components/ui/icons";

const ALLOWED_EXTENSIONS = [".pdf", ".txt", ".docx"];
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

interface UploadDropzoneProps {
  onUpload: (files: File[]) => Promise<boolean>;
  disabled?: boolean;
}

export function UploadDropzone({ onUpload, disabled }: UploadDropzoneProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSelectedFiles = (selected: FileList | null) => {
    if (!selected) return;
    setError(null);
    const valid: File[] = [];

    for (const file of Array.from(selected)) {
      const ext = `.${file.name.split(".").pop()?.toLowerCase()}`;
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        setError(`"${file.name}" is not supported. Only PDF, TXT, and DOCX files are allowed.`);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setError(`"${file.name}" exceeds the 25MB file size limit.`);
        return;
      }
      valid.push(file);
    }
    setFiles(valid.slice(0, 10));
  };

  const handleSubmit = async () => {
    if (files.length === 0 || isUploading) return;
    setIsUploading(true);
    const success = await onUpload(files);
    setIsUploading(false);
    if (success) setFiles([]);
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          handleSelectedFiles(e.dataTransfer.files);
        }}
        className={`p-6 rounded-2xl border-2 border-dashed text-center cursor-pointer transition-colors ${
          isDragOver
            ? "border-blue-500 bg-blue-950/20"
            : "border-zinc-700 bg-[#262626]/50 hover:bg-[#262626]"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.txt,.docx"
          className="hidden"
          onChange={(e) => handleSelectedFiles(e.target.files)}
        />
        <UploadIcon className="w-6 h-6 mx-auto mb-2 text-zinc-400" />
        <p className="text-sm font-medium text-white">Click or drag & drop files here</p>
        <p className="text-xs text-zinc-400 mt-1">PDF, TXT, or DOCX (max 25MB, up to 10 files)</p>
      </div>

      {error && <p className="text-xs text-red-400 px-1">{error}</p>}

      {files.length > 0 && (
        <div className="flex items-center justify-between p-3 rounded-2xl bg-[#262626] border border-zinc-800 text-xs">
          <span className="text-zinc-300 truncate mr-2">
            {files.map((f) => f.name).join(", ")} ({files.length} file{files.length > 1 ? "s" : ""})
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setFiles([])}
              className="p-1 text-zinc-400 hover:text-white"
              title="Clear selection"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isUploading || disabled}
              className="px-4 py-1.5 rounded-full bg-white text-black font-medium hover:bg-zinc-200 disabled:opacity-50 transition-colors"
            >
              {isUploading ? "Uploading..." : `Upload (${files.length})`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
