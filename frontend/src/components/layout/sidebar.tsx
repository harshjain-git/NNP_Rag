"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import type { User, Conversation } from "@/types";
import {
  PanelLeftCloseIcon,
  CloseIcon,
  PlusIcon,
  DocumentIcon,
  UploadIcon,
  ShieldIcon,
  MoreVerticalIcon,
  TrashIcon,
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
  onDeleteConversation?: (id: string) => Promise<boolean>;
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
  onDeleteConversation,
}: SidebarProps) {
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [confirmDeleteConv, setConfirmDeleteConv] = useState<Conversation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close conversation three-dot menu when clicking outside
  useEffect(() => {
    if (!activeMenuId) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeMenuId]);

  // Handle escape key to dismiss popovers/dialogs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveMenuId(null);
        if (!isDeleting) setConfirmDeleteConv(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDeleting]);

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
            {isAdmin && (
              <Link
                href="/documents?action=upload"
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-800/70 transition-colors"
              >
                <UploadIcon className="w-4 h-4 text-zinc-400" />
                <span>Upload Document</span>
              </Link>
            )}
          </div>

          {/* Administration Section (Role-Gated) */}
          {isAdmin && (
            <div className="mb-5 pt-3 border-t border-zinc-800/80">
              <div className="px-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                Administration
              </div>
              <div className="space-y-1">
                <Link
                  href="/admin"
                  className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-800/70 transition-colors"
                >
                  <ShieldIcon className="w-4 h-4 text-blue-400" />
                  <span>Prompt Management</span>
                </Link>
                {user?.role === "SUPER_ADMIN" && (
                  <Link
                    href="/admin/super"
                    className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-800/70 transition-colors"
                  >
                    <ShieldIcon className="w-4 h-4 text-amber-400" />
                    <span>Super Admin Console</span>
                  </Link>
                )}
              </div>
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
                  <div key={conv.id} className="group relative flex items-center">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectConversation?.(conv.id);
                        onMobileClose();
                      }}
                      className={`w-full text-left truncate pl-3.5 pr-8 py-2 rounded-2xl text-sm transition-colors ${
                        conv.id === activeConversationId
                          ? "bg-zinc-800 text-white font-medium"
                          : "text-zinc-300 hover:text-white hover:bg-zinc-800/70"
                      }`}
                      title={conv.title}
                    >
                      {conv.title || "Untitled Conversation"}
                    </button>

                    {onDeleteConversation && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId((prev) => (prev === conv.id ? null : conv.id));
                        }}
                        aria-label="Conversation options"
                        className={`absolute right-1.5 p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700/60 transition-opacity ${
                          activeMenuId === conv.id
                            ? "opacity-100"
                            : "opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"
                        }`}
                      >
                        <MoreVerticalIcon className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {activeMenuId === conv.id && (
                      <div
                        ref={menuRef}
                        className="absolute right-0 top-full mt-1 z-30 w-44 rounded-xl bg-[#262626] border border-zinc-700/80 p-1 shadow-2xl"
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(null);
                            setDeleteError(null);
                            setConfirmDeleteConv(conv);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-red-400 hover:text-red-300 hover:bg-red-950/40 transition-colors text-left"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                          <span>Delete conversation</span>
                        </button>
                      </div>
                    )}
                  </div>
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

        {/* Delete Conversation Confirmation Dialog */}
        {confirmDeleteConv && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          >
            <div className="w-full max-w-sm bg-[#262626] border border-zinc-700/80 rounded-2xl p-5 shadow-2xl space-y-4">
              <div className="flex items-start justify-between">
                <h3 id="delete-dialog-title" className="text-sm font-semibold text-white">
                  Delete conversation?
                </h3>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setConfirmDeleteConv(null)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white"
                >
                  <CloseIcon className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                This will delete{" "}
                <strong className="text-white">
                  &ldquo;{confirmDeleteConv.title || "Untitled Conversation"}&rdquo;
                </strong>{" "}
                and all of its messages. This action cannot be undone.
              </p>
              {deleteError && (
                <div className="px-3 py-1.5 rounded-xl bg-red-950/40 border border-red-800 text-red-200 text-xs">
                  {deleteError}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setConfirmDeleteConv(null)}
                  className="px-3.5 py-1.5 rounded-full text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={async () => {
                    if (!onDeleteConversation) return;
                    setIsDeleting(true);
                    setDeleteError(null);
                    try {
                      const success = await onDeleteConversation(confirmDeleteConv.id);
                      if (success) {
                        setConfirmDeleteConv(null);
                      } else {
                        setDeleteError("Failed to delete conversation. Please try again.");
                      }
                    } catch (err) {
                      setDeleteError(
                        err instanceof Error ? err.message : "Failed to delete conversation."
                      );
                    } finally {
                      setIsDeleting(false);
                    }
                  }}
                  className="px-4 py-1.5 rounded-full text-xs font-medium text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 transition-colors"
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}

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
