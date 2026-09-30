import { useCallback, useEffect, useLayoutEffect, useState } from "react";

export type CmsTheme = "light" | "dark";

const THEME_KEY = "bwc.cms.theme";

// useLayoutEffect on the client so the theme is applied before first paint
// (no light flash when moving between admin routes); useEffect on the server.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function readStoredTheme(): CmsTheme {
  try {
    return window.localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function applyTheme(theme: CmsTheme) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  // styles.css defines its dark variable block under `.dark` (and the
  // Tailwind `dark:` variant keys off it too), so toggle that class as well.
  root.classList.toggle("dark", theme === "dark");
}

function clearTheme() {
  const root = document.documentElement;
  root.removeAttribute("data-theme");
  root.classList.remove("dark");
}

/**
 * CMS-only light/dark theme. Applied to <html> while an admin page is
 * mounted and removed again when leaving, so the public site never picks it up.
 * Defaults to light; the stored choice wins on load.
 */
export function useCmsTheme() {
  const [theme, setTheme] = useState<CmsTheme>("light");

  useIsoLayoutEffect(() => {
    const stored = readStoredTheme();
    setTheme(stored);
    applyTheme(stored);
    return clearTheme;
  }, []);

  const toggle = useCallback(() => {
    const next: CmsTheme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      /* storage unavailable: choice just won't persist */
    }
  }, [theme]);

  return { theme, toggle };
}