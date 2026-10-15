"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useConversations } from "@/hooks/useConversations";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export function AppLayout({
  children,
  maxWidth = "max-w-2xl",
}: {
  children: React.ReactNode;
  maxWidth?: string;
}) {
  const router = useRouter();
  const { user, token, isAuthenticated, isLoading, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { conversations, deleteConversationById } = useConversations(token);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated || !user) {
    return <div className="h-screen w-full bg-[#212121]" />;
  }

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
          isLoading={isLoading}
        />
        <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 min-h-0">
          <div className={`${maxWidth} mx-auto space-y-6`}>{children}</div>
        </main>
      </div>
    </div>
  );
}
