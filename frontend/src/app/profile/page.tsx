"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { AppLayout } from "@/components/layout/app-layout";
import { updateProfile } from "@/lib/api/auth";
import { UserIcon } from "@/components/ui/icons";

export default function ProfilePage() {
  const { user, token, updateUser } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setError("Name is required.");
    if (trimmed.length > 100) return setError("Name cannot exceed 100 characters.");

    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await updateProfile({ name: trimmed }, token);
      updateUser({ ...user, name: res.user.name });
      setSuccess("Profile updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="pb-3 border-b border-zinc-800">
        <h1 className="text-xl font-semibold text-white tracking-tight">User Profile</h1>
        <p className="text-xs text-zinc-400 mt-1">View account information and manage your display name.</p>
      </div>

      {error && <div className="p-3.5 rounded-2xl bg-red-950/40 border border-red-800 text-red-200 text-xs">{error}</div>}
      {success && <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-800 text-emerald-200 text-xs">{success}</div>}

      <div className="p-6 rounded-2xl bg-[#262626] border border-zinc-800 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center text-lg font-bold text-white uppercase shrink-0">
          {user.name?.charAt(0) || "U"}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-white truncate">{user.name}</h2>
          <p className="text-xs text-zinc-400 truncate">{user.email}</p>
          <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
            {user.role}
          </span>
        </div>
      </div>

      <div className="p-6 rounded-2xl bg-[#262626] border border-zinc-800 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white pb-2 border-b border-zinc-800">
          <UserIcon className="w-4 h-4 text-zinc-400" />
          <span>Account Details</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Display Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-[#2f2f2f] border border-zinc-700 text-sm text-white focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Email Address</label>
            <input
              type="email"
              value={user.email}
              disabled
              className="w-full px-3.5 py-2 rounded-xl bg-[#222] border border-zinc-800 text-sm text-zinc-500 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Assigned Role</label>
            <input
              type="text"
              value={user.role}
              disabled
              className="w-full px-3.5 py-2 rounded-xl bg-[#222] border border-zinc-800 text-sm text-zinc-500 cursor-not-allowed"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-full bg-white text-black font-medium text-xs hover:bg-zinc-200 transition-colors disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
