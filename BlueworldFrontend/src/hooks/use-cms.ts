/**
 * Data hooks for the public site.
 *
 * The lists (hero slides, products, team, ...) are read from the CMS store in
 * `lib/cms-store.ts`, which loads everything ONCE, keeps a saved copy in the
 * browser, and re-reads the server about every 5 minutes. So:
 *   - moving between pages never shows a loading state again,
 *   - a browser reload shows the last copy straight away instead of a skeleton,
 *   - each hook below is only a view onto that shared copy (no extra requests).
 *
 * `data` stays undefined until there is something real to show, so a component
 * never flashes the demo placeholder content while it waits.
 */
import { useQuery } from "@tanstack/react-query";
import { ENDPOINTS, fetchWithFallback, apiFetch } from "@/lib/api";
import { useCmsPhase, useCmsState, type CmsState, type CollectionKey } from "@/lib/cms-store";
import type { SiteSettings } from "@/lib/types";
import type { CmsPage } from "@/lib/types";

export interface CollectionResult<T> {
  data: T | undefined;
  isLoading: boolean;
  isPending: boolean;
  isFetching: false;
  isError: false;
}

function result<T>(value: T, loading: boolean): CollectionResult<T> {
  return { data: loading ? undefined : value, isLoading: loading, isPending: loading, isFetching: false, isError: false };
}

function useCollectionResult<K extends CollectionKey>(key: K): CollectionResult<CmsState[K]> {
  const state = useCmsState();
  const phase = useCmsPhase();
  return result(state[key], phase === "pending");
}

export function useHeroSlides() {
  return useCollectionResult("heroSlides");
}

export function useBusinessUnits() {
  return useCollectionResult("businessUnits");
}

export function useBusinessUnit(slug: string) {
  const query = useBusinessUnits();
  return { ...query, unit: query.data?.find((u) => u.slug === slug) };
}

export function useProducts() {
  return useCollectionResult("products");
}

export function useTeamMembers() {
  return useCollectionResult("teamMembers");
}

export function useBlogPosts() {
  return useCollectionResult("blogPosts");
}

export function useJobPostings() {
  return useCollectionResult("jobPostings");
}

export function useMediaLibrary() {
  return useCollectionResult("mediaLibrary");
}

export function useSiteSettings(): CollectionResult<SiteSettings> {
  const state = useCmsState();
  const phase = useCmsPhase();
  return result(state.settings, phase === "pending");
}

import { GLOBE_SETTINGS_DEFAULT, type GlobeSettings } from "@/data/globe-content";

export function useGlobeSettings() {
  return useQuery({
    queryKey: ["globe-settings"],
    queryFn: () => fetchWithFallback<GlobeSettings>("/cms/globe-settings", GLOBE_SETTINGS_DEFAULT),
  });
}

/** One CMS page (about, leadership, ...). Kept for 5 minutes, so going back to a page it already loaded is instant. */
export function usePage(slug: string) {
  return useQuery({
    queryKey: ["cms", "page", slug],
    queryFn: () => apiFetch<CmsPage>(`${ENDPOINTS.pages}/${slug}`),
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    refetchIntervalInBackground: false,
    placeholderData: (previous) => previous,
    retry: 0,
  });
}
