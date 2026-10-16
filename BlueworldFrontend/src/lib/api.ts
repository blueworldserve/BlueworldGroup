import type { MediaAsset } from "@/lib/types";

export const API_BASE_URL =
  (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ?? "http://localhost:8000";

const DEFAULT_TIMEOUT_MS = 4000;

export const ENDPOINTS = {
  heroSlides: "/cms/hero-slides",
  products: "/cms/products",
  businessUnits: "/cms/business-units",
  teamMembers: "/cms/team",
  blogPosts: "/cms/blog-posts",
  jobPostings: "/cms/jobs",
  settings: "/cms/settings",
  media: "/cms/media",
  careersApply: "/careers/apply",
  contact: "/contact",
  newsletter: "/newsletter/subscribe",
  adminContactMessages: "/admin/submissions/contact",
  adminNewsletter: "/admin/submissions/newsletter",
  authLogin: "/auth/login",
  authRefresh: "/auth/refresh",
  authMe: "/auth/me",
  requestAccess: "/auth/request-access",
  accessRequests: "/auth/access-requests",
  users: "/auth/users",
  pages: "/cms/pages",
  adminPages: "/admin/pages",
  countryShowcases: "/cms/country-showcases",
  adminCountryShowcases: "/admin/country-showcases",
} as const;

/** Thrown when the backend actually responded but rejected the request. */
export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, detail: unknown, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  try {
    return await request<T>(path, init, timeoutMs);
  } catch (err) {
    // Signed-in session whose short-lived access token has expired: quietly swap it
    // for a fresh one using the refresh token, then try the same request once more.
    if (err instanceof ApiError && err.status === 401 && canRefresh(path)) {
      if (await refreshAccessToken()) return request<T>(path, init, timeoutMs);
    }
    throw err;
  }
}

async function request<T>(path: string, init: RequestInit, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        ...(init.headers ?? {}),
        ...authHeader(),
      },
    });
    if (!res.ok) {
      let detail: unknown = null;
      try {
        detail = await res.json();
      } catch {
        // response wasn't JSON — leave detail null
      }
      throw new ApiError(res.status, detail, `API ${res.status} on ${path}`);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function uploadMedia(file: File): Promise<MediaAsset> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await authedFetch(`${API_BASE_URL}/admin/media/upload`, {
    method: "POST", // deliberately no content-type header: the browser sets the multipart boundary
    body: formData,
  });

  if (!res.ok) {
    let detail: unknown = null;
    try {
      detail = await res.json();
    } catch {
      // not JSON
    }
    throw new ApiError(res.status, detail, `API ${res.status} on /admin/media/upload`);
  }
  return (await res.json()) as MediaAsset;
}

/** Uploads a video to Cloudinary via the backend. Returns just the hosted URL (videos aren't added to the image Media Library). */
export async function uploadVideo(file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append("file", file);

  // Videos are big; the default 4s API timeout doesn't apply here (plain fetch), so no abort.
  const res = await authedFetch(`${API_BASE_URL}/admin/media/upload-video`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    let detail: unknown = null;
    try {
      detail = await res.json();
    } catch {
      // not JSON
    }
    throw new ApiError(res.status, detail, `API ${res.status} on /admin/media/upload-video`);
  }
  return (await res.json()) as { url: string };
}

/** Result of a fallback-aware read. `isLive` is true if the result actually came from the backend, false if the fallback was used instead. */
export interface SourcedResult<T> {
  data: T;
  /** true = came from the backend; false = local placeholder was used instead. */
  isLive: boolean;
}

/**
 * Same fallback behaviour as `fetchWithFallback`, but also reports whether
 * the result actually came from the backend or is local placeholder content.
 * Use this wherever the caller needs to know the difference (e.g. the admin
 * panel warning banner) — use the plain `fetchWithFallback` wherever the
 * caller just wants data and doesn't care where it came from.
 */
export async function fetchWithSource<T>(path: string, fallback: T): Promise<SourcedResult<T>> {
  try {
    const data = await apiFetch<unknown>(path, { method: "GET" });
    if (data && typeof data === "object" && "items" in (data as Record<string, unknown>)) {
      const items = (data as { items: unknown }).items;
      if (Array.isArray(items) && items.length > 0) return { data: items as unknown as T, isLive: true };
      return { data: fallback, isLive: false };
    }
    if (Array.isArray(data) && data.length === 0) return { data: fallback, isLive: false };
    if (data == null) return { data: fallback, isLive: false };
    return { data: data as T, isLive: true };
  } catch (err) {
    console.warn(`[api] GET ${path} failed, using placeholder data:`, err);
    return { data: fallback, isLive: false };
  }
}

/**
 * Read helper. Never throws — resolves to `fallback` when the backend is not
 * reachable. Accepts either a bare array or `{ items: [...] }`. Real errors
 * are logged to the console so they're visible during development instead of
 * silently disappearing.
 */
export async function fetchWithFallback<T>(path: string, fallback: T): Promise<T> {
  const { data } = await fetchWithSource(path, fallback);
  return data;
}

const FORM_TIMEOUT_MS = 15_000;

/**
 * POST for public forms (contact, newsletter, careers). It NEVER pretends it worked: if the server is unreachable, times out or rejects the
 * request, it throws — show `formErrorMessage(err)` to the visitor.
 */
export async function submitForm<TBody>(path: string, body: TBody): Promise<void> {
  await apiFetch<unknown>(path, { method: "POST", body: JSON.stringify(body) }, FORM_TIMEOUT_MS);
}

/** Turns any error thrown by submitForm into a short, human message. */
export function formErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 429) return "Too many attempts. Please wait a minute and try again.";
    if (err.status === 422) {
      const items = (err.detail as { detail?: unknown } | null)?.detail;
      const loc = Array.isArray(items) ? ((items[0] as { loc?: unknown[] } | undefined)?.loc ?? []) : [];
      const field = String(loc[loc.length - 1] ?? "");
      if (field === "message") return "Please keep your message between 5 and 800 characters.";
      if (field === "email") return "Please enter a valid email address.";
      if (field === "fullName") return "Please enter your full name.";
      if (field === "coverMessage") return "Please keep your message under 3,000 characters.";
      if (field === "phone") return "Please check your phone number.";
      return "Please check your details and try again.";
    }
    return "Something went wrong on our side. Please try again shortly.";
  }
  return "We couldn't reach the server. Check your connection and try again.";
}

/** Best-effort message from a FastAPI error body ({ detail: "..." }), for the admin panel. */
export function apiErrorDetail(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const detail = (err.detail as { detail?: unknown } | null)?.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
  }
  return fallback;
}

/* --------------------------------- tokens --------------------------------- */

const TOKEN_KEY = "bwc.admin.tokens";

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

export function readTokens(): StoredTokens | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as StoredTokens) : null;
  } catch {
    return null;
  }
}

export function writeTokens(tokens: StoredTokens | null) {
  if (typeof window === "undefined") return;
  if (!tokens) window.localStorage.removeItem(TOKEN_KEY);
  else window.localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
}

function authHeader(): Record<string, string> {
  const tokens = readTokens();
  return tokens ? { authorization: `Bearer ${tokens.accessToken}` } : {};
}

/* ---------------------------- silent token refresh ---------------------------- */

/** Fired when the refresh token itself is no longer valid — the admin must sign in again. */
export const SESSION_EXPIRED_EVENT = "bwc:session-expired";

let refreshing: Promise<boolean> | null = null;

function canRefresh(path: string): boolean {
  return path !== ENDPOINTS.authLogin && path !== ENDPOINTS.authRefresh && !!readTokens()?.refreshToken;
}

/** Swaps the refresh token for new tokens. One call at a time; everyone waits for the same result. */
function refreshAccessToken(): Promise<boolean> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const tokens = readTokens();
    if (!tokens?.refreshToken) return false;
    try {
      const res = await fetch(`${API_BASE_URL}${ENDPOINTS.authRefresh}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      });
      if (res.ok) {
        const data = (await res.json()) as { accessToken: string; refreshToken: string };
        writeTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
        return true;
      }
      if (res.status === 401 || res.status === 403 || res.status === 422) {
        // The refresh token is dead too: end the session cleanly instead of failing every save.
        writeTokens(null);
        if (typeof window !== "undefined") window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      }
      return false;
    } catch {
      return false; // network trouble — keep the session, let the caller report the error
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/** Seconds until the access token expires, read from the token itself (no network). */
function secondsLeft(token: string): number | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const payload = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp - Date.now() / 1000 : null;
  } catch {
    return null;
  }
}

/**
 * fetch() for file uploads. Refreshes an expiring token BEFORE sending, so a large
 * video isn't uploaded in full only to be rejected, and retries once on a 401.
 */
async function authedFetch(url: string, init: RequestInit): Promise<Response> {
  const tokens = readTokens();
  if (tokens) {
    const left = secondsLeft(tokens.accessToken);
    if (left !== null && left < 60) await refreshAccessToken();
  }
  const send = () => fetch(url, { ...init, headers: { ...(init.headers ?? {}), ...authHeader() } });
  let res = await send();
  if (res.status === 401 && readTokens()?.refreshToken && (await refreshAccessToken())) res = await send();
  return res;
}