import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

interface DecodedToken {
  sub?: string;
  role?: string;
  exp?: number;
}

function parseTokenPayload(token: string): DecodedToken | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    const decoded = JSON.parse(jsonPayload) as DecodedToken;
    if (!decoded || typeof decoded !== "object") return null;
    if (typeof decoded.exp === "number" && decoded.exp * 1000 <= Date.now()) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Never intercept internal Next.js assets, chunks, or Turbopack HMR routes
  if (pathname.startsWith("/_next") || pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const token = request.cookies.get("nnt_rag_token")?.value;
  const payload = token ? parseTokenPayload(token) : null;
  const isAuthenticated = Boolean(payload);

  const isPublicRoute = pathname === "/login" || pathname === "/register";
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");

  if (!isAuthenticated && !isPublicRoute) {
    const loginUrl = new URL("/login", request.url);
    const destination = pathname + search;
    if (destination !== "/" && destination !== "") {
      loginUrl.searchParams.set("redirect", destination);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticated && isPublicRoute) {
    const redirectParam = request.nextUrl.searchParams.get("redirect");
    const safeRedirect =
      redirectParam &&
      redirectParam.startsWith("/") &&
      !redirectParam.startsWith("//") &&
      !redirectParam.includes("://")
        ? redirectParam
        : "/";
    return NextResponse.redirect(new URL(safeRedirect, request.url));
  }

  if (isAdminRoute) {
    if (!isAuthenticated) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname + search);
      return NextResponse.redirect(loginUrl);
    }

    const isAdmin = payload?.role === "ADMIN" || payload?.role === "SUPER_ADMIN";
    if (!isAdmin) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
