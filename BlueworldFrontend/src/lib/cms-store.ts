/**
 * Client-side CMS store, backed by the real FastAPI backend.
 *
 * Reads hit the public /cms/* endpoints (falling back to placeholder content
 * if the backend is unreachable, via fetchWithSource). Writes hit the
 * authenticated /admin/* endpoints and require a signed-in admin/editor
 * session with the JWT already attached via api.ts's authHeader().
 *
 * Each collection also tracks a `dataSource` ("live" | "placeholder") so
 * callers, specifically the admin panel, can tell real backend data apart
 * from local fallback content. See useCmsDataSources() below.
 */
import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { apiFetch, fetchWithSource } from "@/lib/api";
import {
  BLOG_POSTS,
  BUSINESS_UNITS,
  HERO_SLIDES,
  JOB_POSTINGS,
  MEDIA_LIBRARY,
  PRODUCTS,
  SITE_SETTINGS,
  TEAM_MEMBERS,
} from "@/data/placeholder-content";
import type {
  BlogPost,
  BusinessUnit,
  CountryShowcase,
  HeroSlide,
  JobPosting,
  MediaAsset,
  Product,
  SiteSettings,
  TeamMember,
} from "@/lib/types";

export interface CmsState {
  heroSlides: HeroSlide[];
  businessUnits: BusinessUnit[];
  products: Product[];
  teamMembers: TeamMember[];
  blogPosts: BlogPost[];
  jobPostings: JobPosting[];
  countryShowcases: CountryShowcase[];
  mediaLibrary: MediaAsset[];
  settings: SiteSettings;
}

export type CollectionKey = Exclude<keyof CmsState, "settings">;

export type DataSource = "live" | "placeholder";

const INITIAL: CmsState = {
  heroSlides: HERO_SLIDES,
  businessUnits: BUSINESS_UNITS,
  products: PRODUCTS,
  teamMembers: TEAM_MEMBERS,
  blogPosts: BLOG_POSTS,
  jobPostings: JOB_POSTINGS,
  // No hardcoded placeholder set for this one (it didn't exist as a
  // collection before this feature), an empty array is fine here: the
  // homepage already renders a perfectly normal "overview" panel with no
  // country selected when this list is empty, so there's no broken-UI risk
  // while waiting for the backend/seed data to load.
  countryShowcases: [],
  mediaLibrary: MEDIA_LIBRARY,
  settings: SITE_SETTINGS,
};

/** Before the first hydrate resolves, everything IS placeholder content. */
const INITIAL_SOURCES: Record<CollectionKey, DataSource> = {
  heroSlides: "placeholder",
  businessUnits: "placeholder",
  products: "placeholder",
  teamMembers: "placeholder",
  blogPosts: "placeholder",
  jobPostings: "placeholder",
  countryShowcases: "placeholder",
  mediaLibrary: "placeholder",
};

/** Public read path + authenticated admin write path for each collection. */
const RESOURCE_PATHS: Record<CollectionKey, { public: string; admin: string }> = {
  heroSlides: { public: "/cms/hero-slides", admin: "/admin/hero-slides" },
  businessUnits: { public: "/cms/business-units", admin: "/admin/business-units" },
  products: { public: "/cms/products", admin: "/admin/products" },
  teamMembers: { public: "/cms/team", admin: "/admin/team" },
  blogPosts: { public: "/cms/blog-posts", admin: "/admin/blog-posts" },
  jobPostings: { public: "/cms/jobs", admin: "/admin/jobs" },
  countryShowcases: { public: "/cms/country-showcases", admin: "/admin/country-showcases" },
  mediaLibrary: { public: "/cms/media", admin: "/admin/media" },
};

const SETTINGS_PATHS = { public: "/cms/settings", admin: "/admin/settings" };

/* --------------------------------- caching --------------------------------- */

/** How often public content is re-read from the server. Everything in between comes from memory. */
const REFRESH_MS = 5 * 60_000;
/** A saved copy older than this is ignored (visitors see a normal first-load instead). */
const MAX_CACHE_AGE_MS = 24 * 60 * 60_000;
const CACHE_KEY = "bwc.cms.cache.v1";

/**
 * pending = nothing to show yet (first visit, still loading)
 * cached  = showing the copy saved from the last visit while a fresh one loads in the background
 * ready   = the first load has finished (live data, or placeholder if the API was unreachable)
 */
export type CmsPhase = "pending" | "cached" | "ready";

let state: CmsState = INITIAL;
let dataSources: Record<CollectionKey, DataSource> = INITIAL_SOURCES;
let phase: CmsPhase = "pending";
let started = false;
let inflight: Promise<void> | null = null;
let lastFetched = 0; // last time the server actually answered
let lastAttempt = 0; // last time we tried (so a down API is retried every 5 min, not every 30 s)
let revision = 0;
const listeners = new Set<() => void>();

function emit() {
  revision += 1;
  listeners.forEach((l) => l());
}

type CachedCms = { savedAt: number; state: CmsState; sources: Record<CollectionKey, DataSource> };

function readCache(): CachedCms | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedCms;
    const keys = Object.keys(RESOURCE_PATHS) as CollectionKey[];
    const looksRight =
      typeof parsed.savedAt === "number" &&
      parsed.state &&
      parsed.sources &&
      parsed.state.settings &&
      keys.every((k) => Array.isArray(parsed.state[k]));
    return looksRight ? parsed : null;
  } catch {
    return null; // storage blocked or the saved copy is damaged: behave like a first visit
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: lastFetched, state, sources: dataSources }));
  } catch {
    /* storage full or blocked: caching is an extra, never required */
  }
}

async function loadAll() {
  const keys = Object.keys(RESOURCE_PATHS) as CollectionKey[];
  // The current copy is the fallback, so a failed refresh keeps what the visitor already sees
  // instead of swapping it for placeholder content.
  const [settings, ...lists] = await Promise.all([
    fetchWithSource(SETTINGS_PATHS.public, state.settings),
    ...keys.map((k) => fetchWithSource(RESOURCE_PATHS[k].public, state[k])),
  ]);
  return { keys, settings, lists };
}

/** Reads every public collection once. Only replaces what really changed, so unchanged screens never re-render. */
function refreshAll(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    let changed = false;
    try {
      const { keys, settings, lists } = await loadAll();
      const nextState: Record<string, unknown> = { ...state };
      const nextSources = { ...dataSources };
      let anyLive = false;

      keys.forEach((key, i) => {
        const result = lists[i]!;
        if (!result.isLive) return; // keep the previous copy and its label
        anyLive = true;
        if (JSON.stringify(result.data) !== JSON.stringify(state[key])) {
          nextState[key] = result.data;
          changed = true;
        }
        if (dataSources[key] !== "live") {
          nextSources[key] = "live";
          changed = true;
        }
      });
      if (settings.isLive) {
        anyLive = true;
        if (JSON.stringify(settings.data) !== JSON.stringify(state.settings)) {
          nextState["settings"] = settings.data;
          changed = true;
        }
      }

      lastAttempt = Date.now();
      if (anyLive) {
        lastFetched = lastAttempt;
        if (changed) {
          state = nextState as unknown as CmsState;
          dataSources = nextSources;
        }
        persist();
      }
    } finally {
      const wasPending = phase !== "ready";
      phase = "ready";
      inflight = null;
      if (changed || wasPending) emit();
    }
  })();
  return inflight;
}

let timer: ReturnType<typeof setInterval> | undefined;

/** Re-reads the server about every 5 minutes while the tab is open and visible (also when the tab is brought back). */
function startAutoRefresh() {
  if (timer || typeof window === "undefined") return;
  const tick = () => {
    if (document.visibilityState !== "visible") return;
    if (Date.now() - Math.max(lastFetched, lastAttempt) >= REFRESH_MS) void refreshAll();
  };
  timer = setInterval(tick, 30_000);
  document.addEventListener("visibilitychange", tick);
}

async function hydrate() {
  if (started || typeof window === "undefined") return;
  started = true;

  const adminArea = window.location.pathname.startsWith("/admin");
  const cached = readCache();
  const usable = cached !== null && Date.now() - cached.savedAt < MAX_CACHE_AGE_MS;

  if (usable) {
    // Show the last copy straight away: a browser reload no longer starts from a blank skeleton.
    state = cached.state;
    dataSources = cached.sources;
    lastFetched = cached.savedAt;
    // Fresh enough? Then do not call the server at all. The admin panel always checks, so editors never see old data.
    if (!adminArea && Date.now() - cached.savedAt < REFRESH_MS) {
      phase = "ready";
      emit();
      startAutoRefresh();
      return;
    }
    phase = "cached";
    emit();
  }

  await refreshAll();
  startAutoRefresh();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  void hydrate();
  return () => listeners.delete(listener);
}

export function useCmsState(): CmsState {
  return useSyncExternalStore(subscribe, () => state, () => INITIAL);
}

/** Increments whenever stored content changes. */
export function useCmsRevision(): number {
  return useSyncExternalStore(subscribe, () => revision, () => 0);
}

/** Where the first load stands. Public pages show a skeleton only while this is "pending". */
export function useCmsPhase(): CmsPhase {
  return useSyncExternalStore(subscribe, () => phase, () => "pending" as CmsPhase);
}

export function useCollection<K extends CollectionKey>(key: K): CmsState[K] {
  return useCmsState()[key];
}

/**
 * "live" once real backend data has loaded for a collection, "placeholder"
 * if the backend was unreachable OR returned nothing for it yet. Use this to
 * warn admins they're looking at fallback content, not saved content.
 */
export function useCmsDataSources(): Record<CollectionKey, DataSource> {
  return useSyncExternalStore(subscribe, () => dataSources, () => INITIAL_SOURCES);
}

type Row = { id: string };

/** Refetch a single collection from the public endpoint (used after a write). */
async function refetch<K extends CollectionKey>(key: K) {
  const { data, isLive } = await fetchWithSource(RESOURCE_PATHS[key].public, state[key]);
  state = { ...state, [key]: data } as CmsState;
  dataSources = { ...dataSources, [key]: isLive ? "live" : "placeholder" };
  persist();
  emit();
}

/**
 * A new item's id (from newId() below, e.g. "t-a1b2c3") never matches a real
 * backend UUID, so its absence from the current fetched list is what
 * distinguishes a create from an edit of an existing row.
 */
export async function upsertItem<K extends CollectionKey>(key: K, item: CmsState[K][number]) {
  const list = state[key] as unknown as Row[];
  const row = item as unknown as Row & Record<string, unknown>;
  const { admin } = RESOURCE_PATHS[key];
  const exists = list.some((r) => r.id === row.id);

  try {
    if (exists) {
      const { id, ...body } = row;
      await apiFetch(`${admin}/${id}`, { method: "PUT", body: JSON.stringify(body) });
    } else {
      const { id: _tempId, ...body } = row;
      await apiFetch(admin, { method: "POST", body: JSON.stringify(body) });
    }
    await refetch(key);
  } catch (error) {
    toast.error("Could not save, check your connection or permissions.");
    throw error;
  }
}

export async function deleteItem(key: CollectionKey, id: string) {
  const { admin } = RESOURCE_PATHS[key];
  try {
    await apiFetch(`${admin}/${id}`, { method: "DELETE" });
    await refetch(key);
  } catch (error) {
    toast.error("Could not delete, check your connection or permissions.");
    throw error;
  }
}

/** Merges a media asset already created via the /upload endpoint into local state. */
export function addUploadedMedia(asset: MediaAsset) {
  state = { ...state, mediaLibrary: [asset, ...state.mediaLibrary] };
  dataSources = { ...dataSources, mediaLibrary: "live" };
  persist();
  emit();
}

export async function updateSettings(settings: SiteSettings) {
  try {
    const updated = await apiFetch<SiteSettings>(SETTINGS_PATHS.admin, {
      method: "PUT",
      body: JSON.stringify(settings),
    });
    state = { ...state, settings: updated };
    persist();
    emit();
  } catch (error) {
    toast.error("Could not save settings, check your connection or permissions.");
    throw error;
  }
}

export function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}