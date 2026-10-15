"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useConversations } from "@/hooks/useConversations";
import { usePrompts } from "@/hooks/usePrompts";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { PromptList } from "@/components/admin/prompt-list";
import { PromptFormModal } from "@/components/admin/prompt-form-modal";
import { PlusIcon, RefreshIcon, CloseIcon, ShieldIcon } from "@/components/ui/icons";
import type { Prompt, PromptType, CreatePromptPayload, UpdatePromptPayload } from "@/types";

const FILTER_TYPES: Array<PromptType | "all"> = ["all", "system", "rag", "citation"];

function AdminView() {
  const router = useRouter();
  const { user, token, isAuthenticated, isLoading: authLoading, logout } = useAuth();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<PromptType | "all">("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);

  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  const { conversations, deleteConversationById } = useConversations(token);
  const {
    prompts,
    isLoading,
    error,
    successMessage,
    refresh,
    create,
    update,
    toggleStatus,
    remove,
    clearFeedback,
  } = usePrompts(token);

  if (authLoading || !isAuthenticated) {
    return <div className="h-screen w-full bg-[#212121]" />;
  }

  if (!isAdmin) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#212121] px-4">
        <div className="max-w-md w-full p-8 rounded-2xl bg-[#262626] border border-red-900/60 text-center space-y-4">
          <ShieldIcon className="w-10 h-10 text-red-400 mx-auto" />
          <h1 className="text-lg font-semibold text-white">Access Denied</h1>
          <p className="text-xs text-zinc-400">
            Administrator privileges are required to access prompt management.
          </p>
          <Link
            href="/"
            className="inline-block px-5 py-2 rounded-full bg-white text-black text-xs font-medium hover:bg-zinc-200 transition-colors"
          >
            Return to Chat
          </Link>
        </div>
      </div>
    );
  }

  const handleModalSubmit = async (payload: CreatePromptPayload | UpdatePromptPayload) => {
    if (editingPrompt) {
      return update(editingPrompt.id, payload as UpdatePromptPayload);
    }
    return create(payload as CreatePromptPayload);
  };

  const filteredPrompts =
    selectedType === "all"
      ? prompts
      : prompts.filter((p) => p.type === selectedType);

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
        onLogout={() => {
          logout();
          router.push("/login");
        }}
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
                <h1 className="text-xl font-semibold text-white">Prompt Management</h1>
                <p className="text-xs text-zinc-400">
                  Configure prompt templates and grounding constraints.
                </p>
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
                {user?.role === "SUPER_ADMIN" && (
                  <Link
                    href="/admin/super"
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#262626] hover:bg-zinc-800 border border-zinc-700 text-zinc-200 hover:text-white font-medium text-xs transition-colors"
                  >
                    <span>Super Admin Console</span>
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setEditingPrompt(null);
                    setIsModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-black font-medium text-xs hover:bg-zinc-200 transition-colors"
                >
                  <PlusIcon className="w-3.5 h-3.5 text-black" />
                  <span>New Prompt</span>
                </button>
              </div>
            </div>


            {/* Feedback Banners */}
            {successMessage && (
              <div className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-800 text-emerald-200 text-xs flex justify-between items-center">
                <span>{successMessage}</span>
                <button type="button" onClick={clearFeedback} className="text-emerald-400 hover:text-white">
                  <CloseIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {error && (
              <div className="p-3 rounded-2xl bg-red-950/40 border border-red-800 text-red-200 text-xs flex justify-between items-center">
                <span>{error}</span>
                <button type="button" onClick={clearFeedback} className="text-red-400 hover:text-white">
                  <CloseIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Type Filters */}
            <div className="flex items-center gap-1.5 text-xs">
              {FILTER_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSelectedType(t)}
                  className={`px-3 py-1 rounded-full font-medium transition-colors capitalize ${
                    selectedType === t
                      ? "bg-white text-black"
                      : "bg-[#262626] text-zinc-400 hover:text-zinc-200 border border-zinc-800"
                  }`}
                >
                  {t === "all" ? "All Prompts" : t}
                </button>
              ))}
            </div>

            {/* Prompt List */}
            <PromptList
              prompts={filteredPrompts}
              isLoading={isLoading}
              onEdit={(prompt) => {
                setEditingPrompt(prompt);
                setIsModalOpen(true);
              }}
              onToggleStatus={toggleStatus}
              onDelete={remove}
              onCreateNew={() => {
                setEditingPrompt(null);
                setIsModalOpen(true);
              }}
            />
          </div>
        </main>
      </div>

      <PromptFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleModalSubmit}
        initialData={editingPrompt}
      />
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="h-screen w-full bg-[#212121]" />}>
      <AdminView />
    </Suspense>
  );
}
