"use client";

import React from "react";
import Link from "next/link";
import type { User, Conversation } from "@/types";
import {
  PanelLeftCloseIcon,
  CloseIcon,
  PlusIcon,
  DocumentIcon,
  UploadIcon,
  ShieldIcon,
} from "@/components/ui/icons";
import { UserProfileMenu } from "./user-profile-menu";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isMobileOpen: boolean;
  onMobileClose: () => void;
  onNewChat: () => void;
  conversations: Conversation[];
  user: User | null;
  isAuthenticated: boolean;
  onLogout: () => void;
  onSelectConversation?: (id: string) => void;
  activeConversationId?: string | null;
}

export function Sidebar({
  isOpen,
  onClose,
  isMobileOpen,
  onMobileClose,
  onNewChat,
  conversations,
  user,
  isAuthenticated,
  onLogout,
  onSelectConversation,
  activeConversationId,
}: SidebarProps) {
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  return (
    <>
      {/* Mobile Sidebar Backdrop Overlay */}
      {isMobileOpen && (
        <div
          role="presentation"
          onClick={onMobileClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col justify-between bg-[#171717] border-r border-zinc-800/80 transition-all duration-300 md:static ${
          isMobileOpen ? "translate-x-0 w-72" : "-translate-x-full md:translate-x-0"
        } ${isOpen ? "md:w-68" : "md:w-0 md:border-none md:overflow-hidden"}`}
      >
        <div className="flex flex-col flex-1 overflow-y-auto px-3.5 py-4 min-w-[17rem]">
          {/* Sidebar Top: Branding & Close/Collapse */}
          <div className="flex items-center justify-between px-2 mb-4">
            <Link
              href="/"
              className="text-base font-semibold tracking-wide text-white hover:text-zinc-200"
            >
              NNT_Rag
            </Link>
            <div className="flex items-center gap-1">
              {/* Desktop Collapse Toggle */}
              <button
                type="button"
                onClick={onClose}
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
                className="hidden md:flex p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <PanelLeftCloseIcon className="w-4 h-4" />
              </button>
              {/* Mobile Close Toggle */}
              <button
                type="button"
                onClick={onMobileClose}
                title="Close sidebar"
                aria-label="Close sidebar"
                className="flex md:hidden p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* New Chat Button */}
          <button
            type="button"
            onClick={onNewChat}
            className="flex items-center gap-2.5 w-full px-4 py-2.5 rounded-full bg-zinc-800/90 hover:bg-zinc-700/90 border border-zinc-700/60 text-white font-medium text-sm transition-colors shadow-xs mb-5"
          >
            <PlusIcon className="w-4 h-4 text-zinc-300" />
            <span>New Chat</span>
          </button>

          {/* Core Navigation Items */}
          <div className="space-y-1 mb-5">
            <Link
              href="/documents"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-800/70 transition-colors"
            >
              <DocumentIcon className="w-4 h-4 text-zinc-400" />
              <span>Documents</span>
            </Link>
            <Link
              href="/documents?action=upload"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-800/70 transition-colors"
            >
              <UploadIcon className="w-4 h-4 text-zinc-400" />
              <span>Upload Document</span>
            </Link>
          </div>

          {/* Administration Section (Role-Gated) */}
          {isAdmin && (
            <div className="mb-5 pt-3 border-t border-zinc-800/80">
              <div className="px-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                Administration
              </div>
              <Link
                href="/admin"
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-800/70 transition-colors"
              >
                <ShieldIcon className="w-4 h-4 text-blue-400" />
                <span>Admin Dashboard</span>
              </Link>
            </div>
          )}

          {/* Chat History Section */}
          <div className="flex-1 mt-2">
            <div className="px-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
              Chat History
            </div>
            {conversations.length > 0 ? (
              <div className="space-y-0.5">
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => {
                      onSelectConversation?.(conv.id);
                      onMobileClose();
                    }}
                    className={`w-full text-left truncate px-3.5 py-2 rounded-2xl text-sm transition-colors ${
                      conv.id === activeConversationId
                        ? "bg-zinc-800 text-white font-medium"
                        : "text-zinc-300 hover:text-white hover:bg-zinc-800/70"
                    }`}
                    title={conv.title}
                  >
                    {conv.title || "Untitled Conversation"}
                  </button>
                ))}
              </div>
            ) : (
              <p className="px-3 py-2 text-xs text-zinc-500">
                {isAuthenticated
                  ? "No previous conversations"
                  : "Sign in to save chat history"}
              </p>
            )}
          </div>
        </div>

        {/* Bottom Profile Area */}
        <UserProfileMenu
          user={user}
          isAuthenticated={isAuthenticated}
          onLogout={onLogout}
        />
      </aside>
    </>
  );
}
