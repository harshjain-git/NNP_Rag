"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@/types";
import {
  UserIcon,
  SettingsIcon,
  LogoutIcon,
  MoreVerticalIcon,
} from "@/components/ui/icons";

interface UserProfileMenuProps {
  user: User | null;
  isAuthenticated: boolean;
  onLogout: () => void;
}

export function UserProfileMenu({
  user,
  isAuthenticated,
  onLogout,
}: UserProfileMenuProps) {
  const router = useRouter();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Close profile menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setIsProfileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard accessibility for logout confirmation dialog
  useEffect(() => {
    if (!isLogoutConfirmOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsLogoutConfirmOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLogoutConfirmOpen]);

  const handleConfirmLogout = () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      onLogout();
    } finally {
      setIsLogoutConfirmOpen(false);
      setIsLoggingOut(false);
    }
  };

  return (
    <div
      ref={profileMenuRef}
      className="relative p-3.5 border-t border-zinc-800/80 min-w-[17rem]"
    >
      {isAuthenticated && user ? (
        <>
          {/* Profile Menu Popover */}
          {isProfileMenuOpen && (
            <div className="absolute bottom-full left-3.5 right-3.5 mb-2 rounded-2xl bg-[#262626] border border-zinc-700/80 p-1.5 shadow-2xl z-50 space-y-0.5">
              <div className="px-3 py-2 border-b border-zinc-700/60 mb-1">
                <p className="text-sm font-medium text-white truncate">
                  {user.name}
                </p>
                <p className="text-xs text-zinc-400 truncate">{user.email}</p>
                <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                  {user.role}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  router.push("/profile");
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-zinc-200 hover:text-white hover:bg-zinc-700/70 transition-colors text-left"
              >
                <UserIcon className="w-4 h-4 text-zinc-400" />
                <span>Profile</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  router.push("/settings");
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-zinc-200 hover:text-white hover:bg-zinc-700/70 transition-colors text-left"
              >
                <SettingsIcon className="w-4 h-4 text-zinc-400" />
                <span>Account Settings</span>
              </button>

              <div className="border-t border-zinc-700/60 my-1" />

              <button
                type="button"
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  setIsLogoutConfirmOpen(true);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-red-400 hover:text-red-300 hover:bg-red-950/40 transition-colors text-left"
              >
                <LogoutIcon className="w-4 h-4 text-red-400" />
                <span>Logout</span>
              </button>
            </div>
          )}

          {/* Profile Trigger Button */}
          <button
            type="button"
            onClick={() => setIsProfileMenuOpen((prev) => !prev)}
            className="flex items-center gap-3 w-full p-2 rounded-2xl hover:bg-zinc-800/80 transition-colors text-left"
            aria-haspopup="true"
            aria-expanded={isProfileMenuOpen}
          >
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-semibold text-white uppercase shrink-0">
              {user.name ? user.name.charAt(0) : "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user.name}
              </p>
              <p className="text-xs text-zinc-400 truncate">{user.email}</p>
            </div>
            <MoreVerticalIcon className="w-4 h-4 text-zinc-400 shrink-0" />
          </button>

          {/* Logout Confirmation Dialog */}
          {isLogoutConfirmOpen && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="logout-title"
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
            >
              <div className="w-full max-w-sm bg-[#262626] border border-zinc-700/80 rounded-2xl p-5 shadow-2xl space-y-4">
                <h3 id="logout-title" className="text-sm font-semibold text-white">
                  Are you sure you want to log out?
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  You will need to sign in again to access your account, documents, and previous conversations.
                </p>
                <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                  <button
                    type="button"
                    disabled={isLoggingOut}
                    onClick={() => setIsLogoutConfirmOpen(false)}
                    className="px-3.5 py-1.5 rounded-full text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isLoggingOut}
                    onClick={handleConfirmLogout}
                    className="px-4 py-1.5 rounded-full text-xs font-medium text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 transition-colors"
                  >
                    {isLoggingOut ? "Logging out..." : "Log out"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="flex-1 text-center py-2 px-3 rounded-full bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition-colors"
          >
            Log In
          </Link>
          <Link
            href="/register"
            className="flex-1 text-center py-2 px-3 rounded-full border border-zinc-700 text-white text-xs font-semibold hover:bg-zinc-800 transition-colors"
          >
            Sign Up
          </Link>
        </div>
      )}
    </div>
  );
}
