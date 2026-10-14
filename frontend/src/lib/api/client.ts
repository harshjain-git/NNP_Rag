import type { ApiErrorResponse } from "@/types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") || "http://localhost:3000";

const TOKEN_KEY = "nnt_rag_token";
let tokenCache: string | null = null;

export class ApiClientError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export const setAuthToken = (token: string | null): void => {
  tokenCache = token;
  if (typeof window !== "undefined") {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }
};

export const getAuthToken = (): string | null => {
  if (tokenCache) return tokenCache;
  if (typeof window !== "undefined") {
    tokenCache = localStorage.getItem(TOKEN_KEY);
    return tokenCache;
  }
  return null;
};

export interface RequestOptions extends RequestInit {
  token?: string | null;
}

export async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { token, headers: customHeaders, body, ...rest } = options;
  const activeToken = token !== undefined ? token : getAuthToken();

  const headers = new Headers(customHeaders);
  if (activeToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${activeToken}`);
  }

  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  if (!isFormData && body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const url = `${API_BASE_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  let res: Response;
  try {
    res = await fetch(url, { ...rest, headers, body });
  } catch (err) {
    throw new ApiClientError(
      err instanceof Error ? err.message : "Network request failed",
      0
    );
  }

  if (res.status === 204) return {} as T;

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);

  if (!res.ok) {
    const errObj = data as ApiErrorResponse | null;
    const msg = errObj?.error || (data as { message?: string })?.message || `Request failed (${res.status})`;
    throw new ApiClientError(msg, res.status, errObj?.details ?? data);
  }

  return data as T;
}
