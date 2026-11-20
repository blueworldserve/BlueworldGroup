import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";

/** The pages most visitors open next. Their code is fetched quietly once the home page has settled. */
const LIKELY_PAGES = ["/products", "/business", "/about", "/blog", "/career", "/contact"] as const;

type NetworkInfo = { saveData?: boolean; effectiveType?: string };

/**
 * Warms the site in the background while the visitor reads the page they landed on.
 * Skipped on Data Saver and on 2G, where quietly spending data would be unkind.
 */
export function usePrefetchSite(enabled: boolean) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const connection = (navigator as Navigator & { connection?: NetworkInfo }).connection;
    if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType ?? "")) return;

    const run = () => {
      for (const to of LIKELY_PAGES) {
        void router.preloadRoute({ to }).catch(() => {
          /* a missed prefetch costs nothing; the page simply loads on click */
        });
      }
    };

    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(run, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(run, 2500);
    return () => window.clearTimeout(id);
  }, [enabled, router]);
}
