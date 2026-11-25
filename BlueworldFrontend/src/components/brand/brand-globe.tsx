import { lazy, Suspense, useState } from "react";
import { Globe as GlobeIcon, Image as ImageIcon, X } from "lucide-react";
import type { GlobeFocus, GlobeMarker } from "@/components/brand/globe-scene";
import { useCollection } from "@/lib/cms-store";
import { resolveTint } from "@/lib/tint";
import { GlobeBoundary } from "@/components/brand/globe-boundary";

const GlobeScene = lazy(() => import("@/components/brand/globe-scene"));

/**
 * Background presets for the square behind the globe, pick one via
 * `background`, or pass a custom CSS gradient/color string directly.
 * "none" is the default: fully transparent, so the globe floats directly
 * on whatever the parent section's own background is, with no separate
 * colored box behind it.
 */
export const GLOBE_BACKGROUNDS = {
  none: "transparent",
  midnight: "linear-gradient(160deg, #0b1220 0%, #0d1526 55%, #0a0f1c 100%)",
  deepBlue: "linear-gradient(160deg, #0c1e3d 0%, #0a1730 55%, #060d1c 100%)",
  slate: "linear-gradient(160deg, #1c2531 0%, #171e28 55%, #10151d 100%)",
  charcoal: "linear-gradient(160deg, #17181c 0%, #131418 55%, #0c0d10 100%)",
} as const;

export type GlobeBackground = keyof typeof GLOBE_BACKGROUNDS;

/** Every preset except "none" renders as a dark panel, so the wordmark
 *  defaults to white against any of them. Only "none" (transparent, sitting
 *  on the page's own background, which can be light or dark) falls back to
 *  the theme's own foreground variable. A custom raw CSS string passed to
 *  `background` is treated as dark too, since that's the overwhelmingly
 *  common case for this component, override with `wordmarkColor` if not. */
function defaultWordmarkColor(background: GlobeBackground | (string & {})): string {
  return background === "none" ? "var(--color-foreground)" : "#ffffff";
}

/** When a country is selected, the globe shrinks into the top-right corner
 *  so the country photo behind it is what you actually see. */
const CORNER_GLOBE_SIZE = 32; // % of the box the corner globe occupies
const CORNER_GLOBE_GAP = 4; // % gap from the top and right edges

interface BrandGlobeProps {
  size?: number;
  maxWidthClass?: string;
  /**
   * Fixed-height mode: a Tailwind height class (with responsive variants,
   * e.g. "h-64 sm:h-72 lg:h-80"), used instead of the aspect-square box.
   * Takes the full width of its parent, no maxWidthClass cap, since the
   * point of this mode is "fill this card at this height", not "cap at some
   * max width". When set, this wins over size/maxWidthClass entirely.
   * Note: this squashes the box into a rectangle, which flattens the curved
   * wordmark and crops the logo. Leave it unset for the normal square look.
   */
  boxHeightClass?: string;
  className?: string;
  background?: GlobeBackground | (string & {});
  /** Overrides the automatic contrast pick above, set this explicitly if
   *  you're passing a custom `background` that isn't dark. */
  wordmarkColor?: string;
  markers?: GlobeMarker[];
  mode?: "animated" | "static";
  showText?: boolean;
  showMotto?: boolean;
  interactive?: boolean;
  showToggle?: boolean;
  standText?: string | null;
  globeMarginX?: number;
  globeMarginTop?: number;
  globeMarginBottom?: number;
  wordmarkCurve?: "inward" | "outward";
  wordmarkHug?: number;
  wordmarkDepth?: number;
  wordmarkGap?: number;
  /** Name of the currently-selected marker, must match a marker's `name`
   *  and a `name` in the countryShowcases CMS collection. Pass "" or null
   *  to show the default panel. */
  activeCountry?: string | null;
  /** Fired when a marker is clicked directly on the globe. Pass the same
   *  setter you use for chips/buttons elsewhere so both stay in sync. */
  onSelectCountry?: (name: string) => void;
}

function buildWordmarkArcPath({
  globeMarginX,
  globeMarginBottom,
  hug,
  depth,
  gap,
  curve,
}: {
  globeMarginX: number;
  globeMarginBottom: number;
  hug: number;
  depth?: number;
  gap: number;
  curve: "inward" | "outward";
}) {
  const startX = globeMarginX;
  const endX = 100 - globeMarginX;
  const y = 100 - globeMarginBottom + gap;
  const halfChord = (endX - startX) / 2;
  const sagitta = depth != null ? Math.max(depth, 1) : Math.max(halfChord * Math.max(hug, 0.05), 1);
  const radius = (halfChord * halfChord + sagitta * sagitta) / (2 * sagitta);
  const largeArcFlag = sagitta > radius ? 1 : 0;
  const sweepFlag = curve === "inward" ? 0 : 1;
  return `M ${startX} ${y} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${endX} ${y}`;
}

export function BrandGlobe({
  size,
  maxWidthClass = "max-w-xl",
  boxHeightClass,
  className,
  background = "none",
  wordmarkColor,
  markers = [],
  mode = "animated",
  showText = true,
  showMotto,
  interactive = true,
  showToggle = true,
  standText = "Five Nigerian-made brands, trusted in homes across Africa and beyond.",
  // Tightened further from earlier passes, the goal is the sphere nearly
  // filling its box, not floating in a visibly empty square. Bottom stays
  // a bit larger than top/sides because the curved wordmark needs that
  // room underneath the globe.
  globeMarginX = 4,
  globeMarginTop = 2,
  globeMarginBottom = 6,
  wordmarkCurve = "inward",
  wordmarkHug = 1,
  wordmarkDepth = 70,
  wordmarkGap = -70,
  activeCountry = null,
  onSelectCountry,
}: BrandGlobeProps) {
  const wordmark = showMotto ?? showText;
  const [view, setView] = useState<"animated" | "static">(interactive ? mode : "static");
  const canToggle = interactive && showToggle;

  // Reads the live CMS collection directly, an admin edit shows up here on
  // the next fetch, no rebuild/redeploy needed, and no separate static file
  // to keep in sync with the database.
  const countryShowcases = useCollection("countryShowcases");
  const showcase = activeCountry
    ? countryShowcases.find((s) => s.name.toLowerCase() === activeCountry.toLowerCase()) ?? null
    : null;

  const focusMarker = activeCountry
    ? markers.find((m) => m.name.toLowerCase() === activeCountry.toLowerCase())
    : null;
  const focus: GlobeFocus | null = focusMarker ? { lat: focusMarker.lat, lng: focusMarker.lng } : null;

  // Default: the globe fills the box. With a country selected it shrinks to a
  // small sphere pinned in the top-right corner (the CSS transition on the
  // wrapper animates the move), so the country photo behind it shows.
  const globeBox = showcase
    ? {
        left: `${100 - CORNER_GLOBE_GAP - CORNER_GLOBE_SIZE}%`,
        right: `${CORNER_GLOBE_GAP}%`,
        top: `${CORNER_GLOBE_GAP}%`,
        bottom: `${100 - CORNER_GLOBE_GAP - CORNER_GLOBE_SIZE}%`,
      }
    : {
        left: `${globeMarginX}%`,
        right: `${globeMarginX}%`,
        top: `${globeMarginTop}%`,
        bottom: `${globeMarginBottom}%`,
      };

  const backgroundCss =
    background in GLOBE_BACKGROUNDS ? GLOBE_BACKGROUNDS[background as GlobeBackground] : background;
  const resolvedWordmarkColor = wordmarkColor ?? defaultWordmarkColor(background);

  const outerStyle = size ? { width: size, height: size } : undefined;
  const outerClassName = size
    ? "relative overflow-hidden rounded-3xl"
    : boxHeightClass
      ? `relative w-full overflow-hidden rounded-3xl ${boxHeightClass} ${className ?? ""}`
      : `relative w-full overflow-hidden rounded-3xl aspect-square mx-auto ${maxWidthClass} ${className ?? ""}`;

  const wordmarkPath = buildWordmarkArcPath({
    globeMarginX,
    globeMarginBottom,
    hug: wordmarkHug,
    depth: wordmarkDepth,
    gap: wordmarkGap,
    curve: wordmarkCurve,
  });

  return (
    <div className={outerClassName} style={{ ...outerStyle, background: backgroundCss }}>
      {/* Tint fallback layer, sits behind the photo, only matters if the
          image 404s, so nothing breaks while a country's image is missing. */}
      {showcase && (
        <div className="absolute inset-0 transition-opacity duration-700" style={{ background: resolveTint(showcase.tint) }} />
      )}

      {/* Country backdrop photo, fades in behind the globe when a marker is selected */}
      <div
        className="absolute inset-0 transition-opacity duration-700 ease-out"
        style={{
          opacity: showcase ? 1 : 0,
          backgroundImage: showcase
            ? `linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.6) 100%), url("${showcase.image.replace(/["\\\n\r]/g, encodeURIComponent)}")`
            : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      {/* The static logo only shows when no country is selected. Picking a
          country while the logo is up switches to the globe view, so the
          photo isn't hidden behind the logo. */}
      {(view === "static" || !interactive) && !showcase ? (
        <img src="/blueworld.png" alt="Blueworld Cosmetics" className="h-full w-full object-cover" draggable={false} />
      ) : (
        <>
          <div className="absolute transition-all duration-700 ease-in-out" style={globeBox}>
            <GlobeBoundary fallback={<img src="/blueworld.png" alt="Blueworld Cosmetics" className="h-full w-full object-contain" draggable={false} />}>
              <Suspense fallback={<div className="h-full w-full animate-pulse rounded-full bg-white/10" />}>
                <GlobeScene
                  markers={markers}
                  interactive
                  focus={focus}
                  selected={activeCountry}
                  onSelect={onSelectCountry}
                />
              </Suspense>
            </GlobeBoundary>
          </div>

          {standText && !showcase && (
            <div className="pointer-events-none absolute left-3 top-3 max-w-[46%] rounded-lg border border-white/15 bg-primary-deep/85 p-2.5 text-[10px] font-medium leading-snug text-primary-foreground shadow-lift">
              {standText}
            </div>
          )}

          {/* Curved wordmark, classic serif per brand direction: Times New
              Roman, bold. `fill` uses resolvedWordmarkColor so it stays
              legible against whatever panel this sits on (white on any dark
              preset, theme-aware when background="none"). The path runs left to right
              along the bottom, so letters always stand upright. (`side="right"` used to be set here;
              browsers disagree on that attribute and some drew the motto upside down.) Hidden
              while a country backdrop is showing, since the label below
              replaces it. */}
          {wordmark && !showcase && (
            <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path id="brand-globe-arc" d={wordmarkPath} fill="none" />
              <text
                fontSize="5.6"
                fontWeight="700"
                fontFamily="'Times New Roman', Times, serif"
                fill={resolvedWordmarkColor}
                letterSpacing="0.08"
              >
                <textPath href="#brand-globe-arc" startOffset="50%" textAnchor="middle">
                  GOD IS OUR STRENGTH
                </textPath>
              </text>
            </svg>
          )}

          {/* Country label, replaces the wordmark/standText while a country is active */}
          {showcase && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/80">{showcase.place}</p>
              <p className="font-display text-lg font-bold leading-tight text-white">{showcase.headline}</p>
            </div>
          )}
        </>
      )}

      {/* Reset button, only shown while a country is active, clears back
          to the deep-blue default panel. Sits top-left so it never overlaps
          the small globe in the top-right corner. */}
      {showcase && onSelectCountry && (
        <button
          type="button"
          onClick={() => onSelectCountry("")}
          aria-label="Back to overview"
          title="Back to overview"
          className="absolute left-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur transition-colors hover:bg-black/70"
        >
          <X size={16} />
        </button>
      )}

      {canToggle && !showcase && (
        <button
          type="button"
          onClick={() => setView((v) => (v === "animated" ? "static" : "animated"))}
          aria-label={view === "animated" ? "Show logo" : "Show interactive globe"}
          title={view === "animated" ? "Show logo" : "Show interactive globe"}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-primary-deep/70 text-primary-foreground backdrop-blur transition-colors hover:bg-primary-deep"
        >
          {view === "animated" ? <ImageIcon size={16} /> : <GlobeIcon size={16} />}
        </button>
      )}
    </div>
  );
}