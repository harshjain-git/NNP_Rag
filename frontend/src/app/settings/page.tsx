"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { AppLayout } from "@/components/layout/app-layout";
import { changePassword } from "@/lib/api/auth";
import { ShieldIcon, EyeIcon, EyeOffIcon, UserIcon } from "@/components/ui/icons";

function PasswordInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-300 mb-1">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-3.5 pr-10 py-2 rounded-xl bg-[#2f2f2f] border border-zinc-700 text-sm text-white focus:outline-hidden"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
          aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        >
          {show ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { user, token } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!currentPassword) return setError("Current password is required.");
    if (!newPassword || newPassword.length < 8) return setError("New password must be at least 8 characters long.");
    if (newPassword !== confirmPassword) return setError("New passwords do not match.");
    if (newPassword === currentPassword) return setError("New password must be different from current password.");

    setIsSaving(true);
    try {
      await changePassword({ currentPassword, newPassword }, token);
      setSuccess("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update password.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="pb-3 border-b border-zinc-800">
        <h1 className="text-xl font-semibold text-white tracking-tight">Account Settings</h1>
        <p className="text-xs text-zinc-400 mt-1">Manage account security and credentials.</p>
      </div>

      {/* Account Overview */}
      <div className="p-6 rounded-2xl bg-[#262626] border border-zinc-800 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <UserIcon className="w-4 h-4 text-zinc-400" />
            <span>Account Overview</span>
          </div>
          <Link href="/profile" className="text-xs text-blue-400 hover:text-blue-300 font-medium">
            Edit Profile &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-zinc-500 block mb-0.5">Full Name</span>
            <span className="text-white font-medium">{user.name}</span>
          </div>
          <div>
            <span className="text-zinc-500 block mb-0.5">Email Address</span>
            <span className="text-white font-medium">{user.email}</span>
          </div>
          <div>
            <span className="text-zinc-500 block mb-0.5">Role Permission</span>
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
              {user.role}
            </span>
          </div>
          {user.createdAt && (
            <div>
              <span className="text-zinc-500 block mb-0.5">Account Created</span>
              <span className="text-zinc-300">{new Date(user.createdAt).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Security & Password */}
      <div className="p-6 rounded-2xl bg-[#262626] border border-zinc-800 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white pb-2 border-b border-zinc-800">
          <ShieldIcon className="w-4 h-4 text-amber-400" />
          <span>Security & Password</span>
        </div>

        {error && <div className="p-3.5 rounded-2xl bg-red-950/40 border border-red-800 text-red-200 text-xs">{error}</div>}
        {success && <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-800 text-emerald-200 text-xs">{success}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordInput
            label="Current Password"
            value={currentPassword}
            onChange={setCurrentPassword}
            placeholder="Enter current password"
          />
          <PasswordInput
            label="New Password (min 8 characters)"
            value={newPassword}
            onChange={setNewPassword}
            placeholder="Enter new password"
          />
          <PasswordInput
            label="Confirm New Password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="Re-enter new password"
          />

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-full bg-white text-black font-medium text-xs hover:bg-zinc-200 transition-colors disabled:opacity-50"
            >
              {isSaving ? "Updating..." : "Update Password"}
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
