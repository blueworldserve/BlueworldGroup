/**
 * Admin auth.
 *
 * `login()` posts to POST /auth/login and nothing else. There is no offline or
 * demo fallback, so no built-in username/password exists anywhere in the site.
 */
import { useSyncExternalStore } from "react";
import { ApiError, ENDPOINTS, SESSION_EXPIRED_EVENT, apiFetch, readTokens, writeTokens } from "@/lib/api";
import type { AdminUser, LoginResponse } from "@/lib/types";

const USER_KEY = "bwc.admin.user";
// Only used to clear a flag that older versions of the site may have left in the browser.
const DEMO_FLAG_KEY = "bwc.admin.demoSession";

const listeners = new Set<() => void>();
let cached: AdminUser | null | undefined;

function read(): AdminUser | null {
  if (typeof window === "undefined") return null;
  if (cached !== undefined) return cached;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    cached = raw && readTokens() ? (JSON.parse(raw) as AdminUser) : null;
  } catch {
    cached = null;
  }
  return cached;
}

function emit() {
  listeners.forEach((l) => l());
}

/** Direct (non-reactive) session read — safe to call inside effects after mount. */
export function getAdminUser(): AdminUser | null {
  return read();
}

export function useAdminUser(): AdminUser | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => null,
  );
}

/** Kept so the login page keeps compiling; there is no demo session any more. */
export function isDemoSession(): boolean {
  return false;
}

export async function login(email: string, password: string): Promise<AdminUser> {
  let result: LoginResponse;
  try {
    result = await apiFetch<LoginResponse>(ENDPOINTS.authLogin, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 429) {
      throw new Error("Too many attempts — please wait a minute and try again.");
    }
    if (error instanceof ApiError) {
      throw new Error("Invalid email or password.");
    }
    throw new Error("Can't reach the server right now. Please try again shortly.");
  }

  writeTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
  cached = result.user;
  window.localStorage.setItem(USER_KEY, JSON.stringify(result.user));
  window.localStorage.removeItem(DEMO_FLAG_KEY);
  emit();
  return result.user;
}

export function logout() {
  writeTokens(null);
  cached = null;
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(USER_KEY);
    window.localStorage.removeItem(DEMO_FLAG_KEY);
  }
  emit();
}

// When a silent token refresh fails for good, sign out here; the admin shell then sends them to the login page.
if (typeof window !== "undefined") {
  window.addEventListener(SESSION_EXPIRED_EVENT, () => logout());
}