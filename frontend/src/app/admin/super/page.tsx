"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useConversations } from "@/hooks/useConversations";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { useProjectConfig } from "@/hooks/useProjectConfig";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { UserManagement } from "@/components/admin/user-management";
import { ProjectConfiguration } from "@/components/admin/project-configuration";
import { RefreshIcon, CloseIcon, ShieldIcon } from "@/components/ui/icons";

function SuperAdminView() {
  const router = useRouter();
  const { user, token, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [tab, setTab] = useState<"users" | "config">("users");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/login");
  }, [authLoading, isAuthenticated, router]);

  const { conversations, deleteConversationById } = useConversations(token);
  const usersHook = useAdminUsers(token);
  const configHook = useProjectConfig(token);

  if (authLoading || !isAuthenticated) return <div className="h-screen w-full bg-[#212121]" />;

  if (user?.role !== "SUPER_ADMIN") {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#212121] px-4">
        <div className="max-w-md w-full p-8 rounded-2xl bg-[#262626] border border-red-900/60 text-center space-y-4">
          <ShieldIcon className="w-10 h-10 text-red-400 mx-auto" />
          <h1 className="text-lg font-semibold text-white">Access Denied</h1>
          <p className="text-xs text-zinc-400">Super Administrator privileges are required to access this console.</p>
          <div className="flex justify-center gap-3 pt-2">
            <Link href="/admin" className="px-4 py-1.5 rounded-full bg-zinc-800 text-zinc-200 text-xs font-medium hover:bg-zinc-700">Prompt Management</Link>
            <Link href="/" className="px-4 py-1.5 rounded-full bg-white text-black text-xs font-medium hover:bg-zinc-200">Return to Chat</Link>
          </div>
        </div>
      </div>
    );
  }

  const error = tab === "users" ? usersHook.error : configHook.error;
  const success = tab === "users" ? usersHook.successMessage : configHook.successMessage;
  const clearFeedback = () => { usersHook.clearFeedback(); configHook.clearFeedback(); };

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
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div>
                <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-0.5">
                  <Link href="/admin" className="hover:text-zinc-300">Prompt Management</Link>
                  <span>/</span>
                  <span className="text-zinc-300">Super Admin</span>
                </div>
                <h1 className="text-xl font-semibold text-white">System Administration</h1>
                <p className="text-xs text-zinc-400">Manage user accounts and configure RAG system parameters.</p>
              </div>

              <button
                type="button"
                onClick={() => (tab === "users" ? usersHook.refresh() : configHook.refresh())}
                disabled={usersHook.isLoading || configHook.isLoading}
                className="p-2 rounded-full bg-[#262626] hover:bg-zinc-800 border border-zinc-700 text-zinc-300"
                title="Refresh"
              >
                <RefreshIcon className={`w-4 h-4 ${usersHook.isLoading || configHook.isLoading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {success && (
              <div className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-800 text-emerald-200 text-xs flex justify-between items-center">
                <span>{success}</span>
                <button type="button" onClick={clearFeedback} className="text-emerald-400 hover:text-white"><CloseIcon className="w-3.5 h-3.5" /></button>
              </div>
            )}
            {error && (
              <div className="p-3 rounded-2xl bg-red-950/40 border border-red-800 text-red-200 text-xs flex justify-between items-center">
                <span>{error}</span>
                <button type="button" onClick={clearFeedback} className="text-red-400 hover:text-white"><CloseIcon className="w-3.5 h-3.5" /></button>
              </div>
            )}

            <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
              <button
                type="button"
                onClick={() => setTab("users")}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  tab === "users" ? "bg-white text-black" : "bg-[#262626] text-zinc-400 hover:text-white border border-zinc-800"
                }`}
              >
                User Management ({usersHook.users.length})
              </button>
              <button
                type="button"
                onClick={() => setTab("config")}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  tab === "config" ? "bg-white text-black" : "bg-[#262626] text-zinc-400 hover:text-white border border-zinc-800"
                }`}
              >
                Project Configuration
              </button>
            </div>

            {tab === "users" ? (
              <UserManagement
                users={usersHook.users}
                isLoading={usersHook.isLoading}
                currentUserId={user?.id}
                onCreateUser={usersHook.createUser}
                onChangeRole={usersHook.changeRole}
                onDeleteUser={usersHook.removeUser}
              />
            ) : (
              <ProjectConfiguration
                config={configHook.config}
                isLoading={configHook.isLoading}
                isSaving={configHook.isSaving}
                onSave={configHook.saveConfig}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function SuperAdminPage() {
  return (
    <Suspense fallback={<div className="h-screen w-full bg-[#212121]" />}>
      <SuperAdminView />
    </Suspense>
  );
}
