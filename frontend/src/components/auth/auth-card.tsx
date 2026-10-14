import React from "react";
import Link from "next/link";

interface AuthCardProps {
  title: string;
  error?: string | null;
  children: React.ReactNode;
  footerPrompt: string;
  footerLinkText: string;
  footerLinkHref: string;
}

export function AuthCard({
  title,
  error,
  children,
  footerPrompt,
  footerLinkText,
  footerLinkHref,
}: AuthCardProps) {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#212121] text-white">
      {/* Top-left Branding */}
      <header className="w-full p-6">
        <Link
          href="/"
          className="text-lg font-semibold tracking-wide text-white hover:opacity-90"
        >
          NNT_Rag
        </Link>
      </header>

      {/* Centered Minimal Authentication Form */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-[360px] sm:max-w-[400px]">
          <h1 className="text-2xl sm:text-3xl font-semibold text-center text-white mb-8 tracking-tight">
            {title}
          </h1>

          {error && (
            <div
              role="alert"
              className="mb-6 p-3.5 rounded-lg bg-red-950/70 border border-red-800 text-red-200 text-sm"
            >
              {error}
            </div>
          )}

          {children}

          <p className="text-center text-sm text-zinc-400 mt-6">
            {footerPrompt}{" "}
            <Link
              href={footerLinkHref}
              className="text-blue-400 hover:text-blue-300 font-medium hover:underline focus:outline-none focus:underline"
            >
              {footerLinkText}
            </Link>
          </p>
        </div>
      </main>

      {/* Minimal Balance Footer */}
      <footer className="py-6 text-center text-xs text-zinc-500">
        NNT_Rag &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
