/**
 * Privacy-friendly visitor tracking for the PUBLIC site (never runs in the CMS).
 *
 * Records: a page was viewed, something was clicked, and how long / how far down a page was read.
 * No cookies, no IP address, no names or emails: the browser invents a random visitor id.
 * Every failure is swallowed. Nothing is sent for signed-in CMS staff, "Do Not Track" browsers or automated browsers.
 */
import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { API_BASE_URL } from "@/lib/api";

const COLLECT_URL = `${API_BASE_URL}/analytics/collect`;
const VISITOR_KEY = "bwc.vid";
const SESSION_KEY = "bwc.sid";
const REFERRER_SENT_KEY = "bwc.ref";
const ADMIN_TOKEN_KEY = "bwc.admin.tokens";

type Kind = "pageview" | "click" | "leave";

interface TrackEvent {
  kind: Kind;
  path: string;
  label?: string | undefined;
  target?: string | undefined;
  section?: string | undefined;
  referrer?: string | undefined;
  device?: "mobile" | "tablet" | "desktop" | undefined;
  durationS?: number | undefined;
  scrollPct?: number | undefined;
}

/* --------------------------------- identity --------------------------------- */

function makeId(): string {
  try {
    return crypto.randomUUID().replace(/-/g, "");
  } catch {
    return Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 10).padEnd(8, "0")).join("");
  }
}

let memoryVisitor: string | undefined;
let memorySession: string | undefined;

function storedId(kind: "local" | "session", key: string): string {
  try {
    const store = kind === "local" ? window.localStorage : window.sessionStorage;
    let id = store.getItem(key);
    if (!id || id.length < 8) {
      id = makeId();
      store.setItem(key, id);
    }
    return id;
  } catch {
    if (kind === "local") return (memoryVisitor ??= makeId());
    return (memorySession ??= makeId());
  }
}

/* ---------------------------------- guards ---------------------------------- */

function trackingAllowed(): boolean {
  if (typeof window === "undefined") return false;
  if (navigator.doNotTrack === "1" || (navigator as Navigator & { webdriver?: boolean }).webdriver) return false;
  try {
    if (window.localStorage.getItem(ADMIN_TOKEN_KEY)) return false; // staff browsing their own site
  } catch {
    /* storage unavailable: carry on */
  }
  return true;
}

function deviceType(): "mobile" | "tablet" | "desktop" {
  const w = window.innerWidth;
  return w < 768 ? "mobile" : w < 1100 ? "tablet" : "desktop";
}

/* ---------------------------------- sending --------------------------------- */

function send(events: TrackEvent[]) {
  if (events.length === 0) return;
  const body = JSON.stringify({ visitorId: storedId("local", VISITOR_KEY), sessionId: storedId("session", SESSION_KEY), events });
  try {
    // text/plain keeps this a "simple" request: no CORS preflight, and sendBeacon survives the page closing.
    const blob = new Blob([body], { type: "text/plain;charset=UTF-8" });
    if (navigator.sendBeacon?.(COLLECT_URL, blob)) return;
    void fetch(COLLECT_URL, { method: "POST", body, keepalive: true, mode: "cors", credentials: "omit", headers: { "content-type": "text/plain;charset=UTF-8" } }).catch(() => {});
  } catch {
    /* tracking must never break the site */
  }
}

let queue: TrackEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | undefined;

function flush() {
  clearTimeout(flushTimer);
  flushTimer = undefined;
  send(queue.splice(0));
}

function enqueue(event: TrackEvent, immediately = false) {
  queue.push(event);
  if (immediately || queue.length >= 15) flush();
  else flushTimer ??= setTimeout(flush, 3000);
}

/* ------------------------------ page bookkeeping ----------------------------- */

let currentPath: string | null = null;
let engagedMs = 0;
let visibleSince: number | null = null;
let maxScroll = 0;

function scrollDepth(): number {
  const doc = document.documentElement;
  const total = doc.scrollHeight;
  if (total <= 0) return 0;
  return Math.min(100, Math.round(((window.scrollY + window.innerHeight) / total) * 100));
}

function bankVisibleTime() {
  if (visibleSince !== null) {
    engagedMs += Date.now() - visibleSince;
    visibleSince = document.visibilityState === "visible" ? Date.now() : null;
  }
}

function reportLeave() {
  if (currentPath === null) return;
  bankVisibleTime();
  const seconds = Math.round(engagedMs / 1000);
  if (seconds > 0) enqueue({ kind: "leave", path: currentPath, durationS: Math.min(seconds, 3600), scrollPct: maxScroll });
  engagedMs = 0;
  maxScroll = scrollDepth();
}

function externalReferrer(): string | undefined {
  try {
    if (window.sessionStorage.getItem(REFERRER_SENT_KEY)) return undefined;
    window.sessionStorage.setItem(REFERRER_SENT_KEY, "1");
    if (!document.referrer) return undefined;
    const host = new URL(document.referrer).host;
    return host && host !== window.location.host ? host.replace(/^www\./, "") : undefined;
  } catch {
    return undefined;
  }
}

function trackPage(path: string) {
  if (path.startsWith("/admin") || !trackingAllowed()) {
    reportLeave();
    currentPath = null;
    return;
  }
  if (path === currentPath) return;
  reportLeave();
  currentPath = path;
  engagedMs = 0;
  visibleSince = document.visibilityState === "visible" ? Date.now() : null;
  maxScroll = scrollDepth();
  enqueue({ kind: "pageview", path, device: deviceType(), referrer: externalReferrer() }, true);
}

/* ----------------------------------- clicks ---------------------------------- */

const tidy = (text: string, limit: number) => {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > limit ? `${flat.slice(0, limit - 1)}…` : flat;
};

function destinationOf(el: Element): string | undefined {
  if (!(el instanceof HTMLAnchorElement)) return undefined;
  const href = el.getAttribute("href") ?? "";
  if (!href || href.startsWith("#")) return undefined;
  if (href.startsWith("tel:")) return "tel:"; // never record the number itself
  if (href.startsWith("mailto:")) return "mailto:";
  try {
    const url = new URL(href, window.location.href);
    return url.origin === window.location.origin ? url.pathname : url.host;
  } catch {
    return undefined;
  }
}

function onClick(event: MouseEvent) {
  if (currentPath === null || !(event.target instanceof Element)) return;
  const start = event.target;
  if (start.closest("[data-no-track]")) return;
  // Anything tagged data-track wins (e.g. "Product: Vivon Glow"); otherwise the nearest link or button.
  const el = start.closest("[data-track]") ?? start.closest("a, button, summary, [role='button']");
  if (!el) return;

  const label =
    tidy(el.getAttribute("data-track") ?? "", 80) ||
    tidy(el.getAttribute("aria-label") ?? "", 80) ||
    tidy(el.textContent ?? "", 80) ||
    tidy(el.querySelector("img")?.getAttribute("alt") ?? "", 80) ||
    "(icon)";
  const sectionEl = el.closest("[data-section], header, nav, footer, section[id]");
  const section = sectionEl ? (sectionEl.getAttribute("data-section") ?? sectionEl.id) || sectionEl.tagName.toLowerCase() : undefined;

  enqueue({ kind: "click", path: currentPath, label, target: destinationOf(el), section });
}

/* ------------------------------------ setup ---------------------------------- */

let started = false;

function start() {
  if (started || typeof window === "undefined") return;
  started = true;

  document.addEventListener("click", onClick, { capture: true, passive: true });

  let ticking = false;
  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        maxScroll = Math.max(maxScroll, scrollDepth());
        ticking = false;
      });
    },
    { passive: true },
  );

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      reportLeave();
      flush();
    } else if (currentPath !== null) {
      visibleSince = Date.now();
    }
  });
  window.addEventListener("pagehide", () => {
    reportLeave();
    flush();
  });
}

/** Call once near the top of the app. Follows the router, so every page change is counted. */
export function useAnalytics() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    try {
      start();
    } catch {
      /* never break the site */
    }
  }, []);

  useEffect(() => {
    try {
      trackPage(pathname);
    } catch {
      /* never break the site */
    }
  }, [pathname]);
}