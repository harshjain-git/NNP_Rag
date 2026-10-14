"use client";

import React from "react";
import Link from "next/link";
import { PanelLeftOpenIcon, MenuIcon } from "@/components/ui/icons";

interface TopbarProps {
  isSidebarOpen: boolean;
  onOpenSidebar: () => void;
  onOpenMobileSidebar: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export function Topbar({
  isSidebarOpen,
  onOpenSidebar,
  onOpenMobileSidebar,
  isAuthenticated,
  isLoading,
}: TopbarProps) {
  return (
    <header className="h-14 flex items-center justify-between px-4 border-b border-zinc-800/70 shrink-0">
      <div className="flex items-center gap-3">
        {/* Desktop Expand Button (when sidebar is collapsed) */}
        {!isSidebarOpen && (
          <button
            type="button"
            onClick={onOpenSidebar}
            title="Expand sidebar"
            aria-label="Expand sidebar"
            className="hidden md:flex p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <PanelLeftOpenIcon className="w-5 h-5" />
          </button>
        )}

        {/* Mobile Hamburger Toggle */}
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          title="Open navigation menu"
          aria-label="Open navigation menu"
          className="flex md:hidden p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <MenuIcon className="w-5 h-5" />
        </button>

        <span className="text-sm font-medium text-zinc-300">
          NNT_Rag <span className="text-zinc-500">/</span> Assistant
        </span>
      </div>

      <div className="flex items-center gap-2">
        {isLoading && (
          <span className="text-xs text-zinc-500">Connecting...</span>
        )}
        {!isAuthenticated && !isLoading && (
          <Link
            href="/login"
            className="text-xs font-medium text-blue-400 hover:text-blue-300"
          >
            Sign In
          </Link>
        )}
      </div>
    </header>
  );
}
