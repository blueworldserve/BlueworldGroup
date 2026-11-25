/**
 * The list of apps and websites owned by Blueworld, shown in the app launcher at the top of the CMS.
 *
 * This is private on purpose. It is read from the signed-in /admin/company-apps endpoint,
 * not from the public /cms/* endpoints, so it never reaches the public website or its saved cache.
 */
import { useSyncExternalStore } from "react";
import { ApiError, apiFetch } from "@/lib/api";

export interface CompanyApp {
  id: string;
  name: string;
  url: string;
  description: string | null;
  icon: string | null;
  order: number;
}

export type CompanyAppInput = Omit<CompanyApp, "id">;

type Status = "idle" | "loading" | "ready" | "error";
interface Snapshot {
  apps: CompanyApp[];
  status: Status;
}

const PATH = "/admin/company-apps";
/** Opening the launcher re-reads the list if it is older than this. */
const STALE_MS = 60_000;

const EMPTY: Snapshot = { apps: [], status: "idle" };
let snapshot: Snapshot = EMPTY;
let loadedAt = 0;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function set(next: Snapshot) {
  snapshot = next;
  listeners.forEach((l) => l());
}

const sortApps = (list: CompanyApp[]) =>
  [...list].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

export function loadCompanyApps(force = false): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (inflight) return inflight;
  if (!force && snapshot.status === "ready" && Date.now() - loadedAt < STALE_MS) return Promise.resolve();

  if (snapshot.status !== "ready") set({ ...snapshot, status: "loading" });
  inflight = apiFetch<CompanyApp[]>(PATH)
    .then((list) => {
      loadedAt = Date.now();
      set({ apps: sortApps(list), status: "ready" });
    })
    .catch(() => {
      // Keep showing what we already have if a refresh fails.
      set({ ...snapshot, status: snapshot.status === "ready" || snapshot.apps.length ? "ready" : "error" });
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCompanyApps(): Snapshot {
  return useSyncExternalStore(subscribe, () => snapshot, () => EMPTY);
}

/** Turns "example.com" into "https://example.com" so people can type the link the lazy way. */
export function normaliseAppUrl(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return value; // some other scheme: leave it, the server rejects it
  return `https://${value}`;
}

/** Just the website name for display, e.g. "hr.blueworld.com". */
export function appHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** Pulls the first readable message out of a FastAPI error. */
export function appErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const detail = error.detail as { detail?: unknown } | null;
    const d = detail?.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) {
      const msg = (d[0] as { msg?: string } | undefined)?.msg;
      if (msg) return msg.replace(/^Value error,\s*/i, "");
    }
    if (error.status === 403) return "You do not have permission to change apps.";
  }
  return "Could not reach the server. Please try again.";
}

export async function saveCompanyApp(id: string | null, body: CompanyAppInput) {
  if (id) await apiFetch(`${PATH}/${id}`, { method: "PUT", body: JSON.stringify(body) });
  else await apiFetch(PATH, { method: "POST", body: JSON.stringify(body) });
  await loadCompanyApps(true);
}

export async function deleteCompanyApp(id: string) {
  await apiFetch(`${PATH}/${id}`, { method: "DELETE" });
  await loadCompanyApps(true);
}
