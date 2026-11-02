import { useCallback, useEffect, useLayoutEffect, useSyncExternalStore } from "react";

export type CmsTheme = "light" | "dark";

const THEME_KEY = "bwc.cms.theme";

// useLayoutEffect on the client so the theme is applied before first paint
// (no light flash when moving between admin routes); useEffect on the server.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/* One shared theme store.
 * Every toggle reads the same store, and only the admin page itself (the "scope",
 * see useCmsThemeScope) decides when the theme is applied or removed. */

let current: CmsTheme = "light";
let scopes = 0;
const listeners = new Set<() => void>();

// Matches --card in styles.css so the phone status bar blends into the header.
const BAR_COLOR: Record<CmsTheme, string> = { light: "#ffffff", dark: "#0f1b3a" };

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function readStored(): CmsTheme {
  try {
    return window.localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function paint(theme: CmsTheme) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.classList.toggle("dark", theme === "dark");
  // Native controls (date pickers, select lists, scrollbars, autofill) follow this.
  root.style.colorScheme = theme;

  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"][data-cms]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.setAttribute("data-cms", "");
    document.head.appendChild(meta);
  }
  meta.content = BAR_COLOR[theme];
}

function clearPaint() {
  const root = document.documentElement;
  root.removeAttribute("data-theme");
  root.classList.remove("dark");
  root.style.colorScheme = "";
  document.querySelector('meta[name="theme-color"][data-cms]')?.remove();
}

export function setCmsTheme(next: CmsTheme) {
  current = next;
  try {
    window.localStorage.setItem(THEME_KEY, next);
  } catch {
    /* storage unavailable: choice just won't persist */
  }
  if (scopes > 0) paint(next);
  emit();
}

/**
 * Call ONCE per admin page (AdminShell does). Applies the stored theme to <html>
 * while an admin page is mounted and removes it again when leaving, so the public
 * site never picks it up. Also keeps several open tabs in sync.
 */
export function useCmsThemeScope() {
  useIsoLayoutEffect(() => {
    scopes += 1;
    current = readStored();
    paint(current);
    emit();

    const onStorage = (e: StorageEvent) => {
      if (e.key !== THEME_KEY) return;
      current = e.newValue === "dark" ? "dark" : "light";
      paint(current);
      emit();
    };
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("storage", onStorage);
      scopes -= 1;
      if (scopes === 0) {
        clearPaint();
        current = "light"; // so public-site widgets (toasts) never see "dark"
        emit();
      }
    };
  }, []);
}

/** Read the current theme and toggle it. Safe to use in any number of components. */
export function useCmsTheme() {
  const theme = useSyncExternalStore(
    subscribe,
    () => current,
    () => "light" as CmsTheme,
  );
  const toggle = useCallback(() => setCmsTheme(current === "dark" ? "light" : "dark"), []);
  return { theme, toggle };
}