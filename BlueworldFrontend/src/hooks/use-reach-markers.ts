import { useMemo } from "react";
import type { GlobeMarker } from "@/components/brand/globe-scene";
import { findCountry } from "@/data/countries";
import { useCollection } from "@/lib/cms-store";

/**
 * The pins on the globe, built from whatever countries exist in the CMS
 * (Country Showcase). Add a country there and it appears here, on the globe,
 * in the chips and in the cards, nothing is listed in code.
 */
export function useReachMarkers(): GlobeMarker[] {
  const showcases = useCollection("countryShowcases");
  return useMemo(
    () =>
      [...showcases]
        .sort((a, b) => a.order - b.order)
        .flatMap((s) => {
          const country = findCountry(s.name);
          return country ? [{ name: s.name, lat: country.lat, lng: country.lng, note: s.place }] : [];
        }),
    [showcases],
  );
}