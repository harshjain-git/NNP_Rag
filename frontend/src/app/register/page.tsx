"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ApiClientError } from "@/lib/api/client";
import { EyeIcon, EyeOffIcon } from "@/components/ui/icons";
import { AuthCard } from "@/components/auth/auth-card";
import { EMAIL_REGEX } from "@/lib/validation";

export default function RegisterPage() {
  const router = useRouter();
  const { register, isAuthenticated, isLoading } = useAuth();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, isLoading, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = form.name.trim();
    const email = form.email.trim();
    const password = form.password;
    const confirmPassword = form.confirmPassword;

    // Client-side validation
    if (!name) return setError("Name is required");
    if (!email) return setError("Email is required");
    if (!EMAIL_REGEX.test(email)) return setError("Valid email is required");
    if (password.length < 8) return setError("Password must be at least 8 characters long");
    if (password !== confirmPassword) return setError("Passwords do not match");

    setIsSubmitting(true);
    setError(null);

    try {
      // Send only name, email, and password to backend (confirmPassword is client-side only)
      await register({ name, email: email.toLowerCase(), password });
      router.push("/");
    } catch (err) {
      setError(
        err instanceof ApiClientError || err instanceof Error
          ? err.message
          : "Registration failed"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthCard
      title="Create your account"
      error={error}
      footerPrompt="Already have an account?"
      footerLinkText="Log in"
      footerLinkHref="/login"
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-zinc-300 mb-1.5"
          >
            Full name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            value={form.name}
            onChange={handleChange}
            disabled={isSubmitting}
            placeholder="Enter your full name"
            required
            className="w-full px-4 py-3 rounded-lg bg-[#2f2f2f] border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 transition-colors"
          />
        </div>

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-zinc-300 mb-1.5"
          >
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={handleChange}
            disabled={isSubmitting}
            placeholder="name@example.com"
            required
            className="w-full px-4 py-3 rounded-lg bg-[#2f2f2f] border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 transition-colors"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-zinc-300 mb-1.5"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={form.password}
              onChange={handleChange}
              disabled={isSubmitting}
              placeholder="At least 8 characters"
              required
              className="w-full pl-4 pr-11 py-3 rounded-lg bg-[#2f2f2f] border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              title={showPassword ? "Hide password" : "Show password"}
              disabled={isSubmitting}
              className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-zinc-400 hover:text-zinc-200 focus:outline-none focus:text-white disabled:opacity-50 transition-colors"
            >
              {showPassword ? (
                <EyeOffIcon className="w-5 h-5" />
              ) : (
                <EyeIcon className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium text-zinc-300 mb-1.5"
          >
            Confirm password
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={handleChange}
              disabled={isSubmitting}
              placeholder="Re-enter your password"
              required
              className="w-full pl-4 pr-11 py-3 rounded-lg bg-[#2f2f2f] border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              aria-label={
                showConfirmPassword
                  ? "Hide confirm password"
                  : "Show confirm password"
              }
              title={
                showConfirmPassword
                  ? "Hide confirm password"
                  : "Show confirm password"
              }
              disabled={isSubmitting}
              className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-zinc-400 hover:text-zinc-200 focus:outline-none focus:text-white disabled:opacity-50 transition-colors"
            >
              {showConfirmPassword ? (
                <EyeOffIcon className="w-5 h-5" />
              ) : (
                <EyeIcon className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full mt-2 py-3 px-4 rounded-full bg-white text-black font-semibold hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#212121] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-base"
        >
          {isSubmitting ? "Creating account..." : "Create Account"}
        </button>
      </form>
    </AuthCard>
  );
}
