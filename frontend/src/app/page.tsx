"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useConversations } from "@/hooks/useConversations";
import { useChat } from "@/hooks/useChat";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { WelcomeScreen } from "@/components/chat/welcome-screen";
import { MessageList } from "@/components/chat/message-list";
import { Composer } from "@/components/chat/composer";

export default function Home() {
  const router = useRouter();
  const { user, token, isAuthenticated, isLoading, logout } = useAuth();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const {
    conversations,
    refreshConversations,
  } = useConversations(token);

  const {
    messages,
    activeConversationId,
    isGenerating,
    error,
    warning,
    sendMessage,
    loadConversation,
    startNewChat,
    clearError,
  } = useChat({
    token,
    onNewConversationCreated: refreshConversations,
  });

  const handleLogout = () => {
    startNewChat();
    logout();
    router.push("/login");
  };

  const handleNewChat = () => {
    startNewChat();
    setInputValue("");
    setIsMobileSidebarOpen(false);
  };

  const handleSelectConversation = (id: string) => {
    loadConversation(id);
    setIsMobileSidebarOpen(false);
  };

  const handleSubmit = async () => {
    if (!inputValue.trim() || isGenerating) return;
    const query = inputValue;
    setInputValue("");
    await sendMessage(query);
  };

  const handleSelectSuggestion = (prompt: string) => {
    if (isGenerating) return;
    setInputValue("");
    sendMessage(prompt);
  };

  const displayedConversations = isAuthenticated ? conversations : [];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#212121] text-zinc-100 font-sans">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
        onNewChat={handleNewChat}
        conversations={displayedConversations}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        user={user}
        isAuthenticated={isAuthenticated}
        onLogout={handleLogout}
      />

      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        <Topbar
          isSidebarOpen={isSidebarOpen}
          onOpenSidebar={() => setIsSidebarOpen(true)}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          isAuthenticated={isAuthenticated}
          isLoading={isLoading}
        />

        <main className="flex-1 flex flex-col items-center justify-between overflow-y-auto px-4 py-6 min-h-0">
          {messages.length === 0 ? (
            <WelcomeScreen onSelectSuggestion={handleSelectSuggestion} />
          ) : (
            <MessageList messages={messages} isGenerating={isGenerating} />
          )}

          {error && (
            <div className="w-full max-w-3xl mb-2 px-4 py-2.5 rounded-2xl bg-red-950/40 border border-red-800/60 text-red-200 text-xs sm:text-sm flex items-center justify-between">
              <span>{error}</span>
              <button
                type="button"
                onClick={clearError}
                className="text-red-400 hover:text-red-200 text-xs ml-2 font-medium"
              >
                Dismiss
              </button>
            </div>
          )}

          {warning && (
            <div className="w-full max-w-3xl mb-2 px-4 py-2 rounded-2xl bg-amber-950/40 border border-amber-800/60 text-amber-200 text-xs">
              {warning}
            </div>
          )}

          <Composer
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleSubmit}
            disabled={isGenerating}
          />
        </main>
      </div>
    </div>
  );
}
