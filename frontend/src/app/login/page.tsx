"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ApiClientError } from "@/lib/api/client";
import { EyeIcon, EyeOffIcon } from "@/components/ui/icons";
import { AuthCard } from "@/components/auth/auth-card";
import { EMAIL_REGEX } from "@/lib/validation";

const getSafeRedirect = (url: string | null): string => {
  if (!url) return "/";
  if (url.startsWith("/") && !url.startsWith("//") && !url.includes("://")) {
    return url;
  }
  return "/";
};

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#212121]" />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = getSafeRedirect(searchParams.get("redirect"));
  const { login, isAuthenticated, isLoading } = useAuth();

  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(redirectTarget);
    }
  }, [isAuthenticated, isLoading, router, redirectTarget]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = form.email.trim();
    const password = form.password;

    // Client-side validation
    if (!email) return setError("Email is required");
    if (!EMAIL_REGEX.test(email)) return setError("Valid email is required");
    if (!password) return setError("Password is required");

    setIsSubmitting(true);
    setError(null);

    try {
      await login({ email: email.toLowerCase(), password });
      router.push(redirectTarget);
    } catch (err) {
      setError(
        err instanceof ApiClientError || err instanceof Error
          ? err.message
          : "Login failed"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthCard
      title="Welcome back"
      error={error}
      footerPrompt="Don't have an account?"
      footerLinkText="Sign up"
      footerLinkHref="/register"
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
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
              autoComplete="current-password"
              value={form.password}
              onChange={handleChange}
              disabled={isSubmitting}
              placeholder="Enter your password"
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

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full mt-2 py-3 px-4 rounded-full bg-white text-black font-semibold hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#212121] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-base"
        >
          {isSubmitting ? "Logging in..." : "Log In"}
        </button>
      </form>
    </AuthCard>
  );
}
