"use client";

import React, { useState } from "react";
import type { SafeUser, RoleName, CreateAdminUserPayload } from "@/types";
import { PlusIcon, TrashIcon, SearchIcon, CloseIcon, UserIcon } from "@/components/ui/icons";

interface UserManagementProps {
  users: SafeUser[];
  isLoading: boolean;
  currentUserId?: string;
  onCreateUser: (payload: CreateAdminUserPayload) => Promise<boolean>;
  onChangeRole: (id: string, role: RoleName) => Promise<boolean>;
  onDeleteUser: (id: string) => Promise<boolean>;
}

export function UserManagement({
  users,
  isLoading,
  currentUserId,
  onCreateUser,
  onChangeRole,
  onDeleteUser,
}: UserManagementProps) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleName | "ALL">("ALL");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchesSearch = u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    return matchesSearch && (roleFilter === "ALL" || u.role === roleFilter);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3.5 py-1.5 rounded-xl bg-[#262626] border border-zinc-700 text-xs sm:text-sm text-white focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2">
          {(["ALL", "USER", "ADMIN", "SUPER_ADMIN"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRoleFilter(r)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                roleFilter === r ? "bg-white text-black" : "bg-[#262626] text-zinc-400 hover:text-white border border-zinc-800"
              }`}
            >
              {r === "ALL" ? "All" : r}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white text-black font-medium text-xs hover:bg-zinc-200 transition-colors"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-xs text-zinc-500 bg-[#262626] rounded-2xl border border-zinc-800">
          Loading users...
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center bg-[#262626] rounded-2xl border border-zinc-800 text-zinc-400 text-xs flex flex-col items-center gap-2">
          <UserIcon className="w-8 h-8 text-zinc-600" />
          <span>No users found</span>
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-800 bg-[#262626] overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#2a2a2a] text-zinc-400 uppercase text-[10px] border-b border-zinc-800">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filtered.map((u) => {
                const isSelf = u.id === currentUserId;
                return (
                  <tr key={u.id} className="hover:bg-zinc-800/40">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white flex items-center gap-1.5">
                        {u.name}
                        {isSelf && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-blue-950 text-blue-300 border border-blue-800">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-zinc-500 text-[11px] font-mono">{u.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        disabled={isSelf}
                        onChange={(e) => onChangeRole(u.id, e.target.value as RoleName)}
                        className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#2f2f2f] border border-zinc-700 text-white disabled:opacity-50"
                      >
                        <option value="USER">USER</option>
                        <option value="ADMIN">ADMIN</option>
                        <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      {isSelf ? (
                        <span className="text-zinc-600">—</span>
                      ) : confirmId === u.id ? (
                        <div className="inline-flex items-center gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteUser(u.id);
                              setConfirmId(null);
                            }}
                            className="text-red-400 hover:text-red-300"
                          >
                            Confirm
                          </button>
                          <button type="button" onClick={() => setConfirmId(null)} className="text-zinc-400 hover:text-white">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmId(u.id)}
                          className="p-1 rounded-lg text-zinc-400 hover:text-red-400"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <CreateUserModal
          onClose={() => setIsModalOpen(false)}
          onSubmit={async (payload) => {
            const ok = await onCreateUser(payload);
            if (ok) setIsModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

function CreateUserModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (payload: CreateAdminUserPayload) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<RoleName>("USER");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Name is required.");
    if (!email.trim() || !email.includes("@")) return setError("Valid email is required.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    onSubmit({ name: name.trim(), email: email.trim().toLowerCase(), password, role });
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-md bg-[#262626] border border-zinc-700 rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
          <h2 className="text-base font-semibold text-white">Create User Account</h2>
          <button type="button" onClick={onClose} className="p-1 rounded-lg text-zinc-400 hover:text-white">
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        {error && <div className="px-3.5 py-2 rounded-xl bg-red-950/40 border border-red-800 text-red-200 text-xs">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl bg-[#2f2f2f] border border-zinc-700 text-sm text-white focus:outline-hidden"
          />
          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl bg-[#2f2f2f] border border-zinc-700 text-sm text-white focus:outline-hidden"
          />
          <input
            type="password"
            placeholder="Password (min 8 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl bg-[#2f2f2f] border border-zinc-700 text-sm text-white focus:outline-hidden"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as RoleName)}
            className="w-full px-3.5 py-2 rounded-xl bg-[#2f2f2f] border border-zinc-700 text-sm text-white focus:outline-hidden"
          >
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
            <option value="SUPER_ADMIN">SUPER_ADMIN</option>
          </select>

          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
            <button type="button" onClick={onClose} className="px-4 py-1.5 rounded-full text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700">
              Cancel
            </button>
            <button type="submit" className="px-5 py-1.5 rounded-full text-xs font-medium text-black bg-white hover:bg-zinc-200">
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
