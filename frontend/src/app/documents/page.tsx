"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useConversations } from "@/hooks/useConversations";
import { useDocuments } from "@/hooks/useDocuments";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { UploadDropzone } from "@/components/documents/upload-dropzone";
import { DocumentTable } from "@/components/documents/document-table";
import { UploadIcon, RefreshIcon, CloseIcon } from "@/components/ui/icons";
import type { DocumentItem } from "@/types";

function DocumentsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, token, isAuthenticated, isLoading: authLoading, logout } = useAuth();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(
    () => searchParams.get("action") === "upload"
  );

  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  const { conversations, deleteConversationById } = useConversations(token);
  const { documents, isLoading, error, skipped, refresh, upload, remove, clearError } =
    useDocuments(token);

  if (authLoading || !isAuthenticated) {
    return <div className="h-screen w-full bg-[#212121]" />;
  }

  const canDelete = (doc: DocumentItem): boolean => {
    if (user?.role === "SUPER_ADMIN") return true;
    if (user?.role === "ADMIN") return !doc.uploadedBy || doc.uploadedBy === user.id;
    return false;
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#212121] text-zinc-100 font-sans">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
        onNewChat={() => router.push("/")}
        conversations={conversations}
        activeConversationId={null}
        onSelectConversation={() => router.push("/")}
        onDeleteConversation={deleteConversationById}
        user={user}
        isAuthenticated={isAuthenticated}
        onLogout={() => { logout(); router.push("/login"); }}
      />

      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        <Topbar
          isSidebarOpen={isSidebarOpen}
          onOpenSidebar={() => setIsSidebarOpen(true)}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          isAuthenticated={isAuthenticated}
          isLoading={authLoading}
        />

        <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 min-h-0">
          <div className="max-w-4xl mx-auto space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div>
                <h1 className="text-xl font-semibold text-white">Documents</h1>
                <p className="text-xs text-zinc-400">Knowledge base documents available for Q&A.</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={refresh}
                  disabled={isLoading}
                  className="p-2 rounded-full bg-[#262626] hover:bg-zinc-800 border border-zinc-700 text-zinc-300"
                  title="Refresh"
                >
                  <RefreshIcon className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setIsUploadOpen((prev) => !prev)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-black font-medium text-xs hover:bg-zinc-200 transition-colors"
                  >
                    <UploadIcon className="w-3.5 h-3.5 text-black" />
                    <span>{isUploadOpen ? "Hide Upload" : "Upload"}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-2xl bg-red-950/40 border border-red-800 text-red-200 text-xs flex justify-between items-center">
                <span>{error}</span>
                <button type="button" onClick={clearError} className="text-red-400 hover:text-white">
                  <CloseIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Skipped Duplicates Notice */}
            {skipped.length > 0 && (
              <div className="p-3 rounded-2xl bg-amber-950/40 border border-amber-800 text-amber-200 text-xs">
                {skipped.length} duplicate file(s) skipped: {skipped.map((s) => s.filename).join(", ")}
              </div>
            )}

            {/* Upload Dropzone */}
            {isAdmin && isUploadOpen && (
              <div className="p-4 rounded-2xl bg-[#262626] border border-zinc-800">
                <UploadDropzone onUpload={upload} />
              </div>
            )}

            {/* Document Table */}
            <DocumentTable
              documents={documents}
              isLoading={isLoading}
              canDelete={canDelete}
              onDelete={remove}
            />
          </div>
        </main>
      </div>
    </div>
  );
}

export default function DocumentsPage() {
  return (
    <Suspense fallback={<div className="h-screen w-full bg-[#212121]" />}>
      <DocumentsView />
    </Suspense>
  );
}
