import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Play, X } from "lucide-react";
import { ButtonLink } from "@/components/site/primitives";
import { resolveImage } from "@/data/images";
import { parseVideoUrl, youtubeBackgroundUrl } from "@/lib/video";
import { useIsMobile } from "@/hooks/use-mobile";
import type { HeroSlide } from "@/lib/types";
import { cn } from "@/lib/utils";

const SLIDE_MS = 7000;
const DEFAULT_RATIO = 16 / 9;

// One slide at a time: fade out fully, then fade in. Never two pictures together.
const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.6, ease: "easeOut" as const } },
  exit: { opacity: 0, transition: { duration: 0.35, ease: "easeIn" as const } },
};

export function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const ordered = useMemo(() => [...slides].sort((a, b) => a.order - b.order), [slides]);
  const count = ordered.length;
  const [index, setIndex] = useState(0);
  const [igOpen, setIgOpen] = useState(false);
  const [ratios, setRatios] = useState<Record<string, number>>({});
  const [shownId, setShownId] = useState<string | null>(null);
  const latestId = useRef<string>("");
  const reduceMotion = useReducedMotion();
  const isMobile = useIsMobile();

  // phones and desktop can use different photos, so ratios are stored per device type
  const rk = useCallback((s: HeroSlide) => `${s.id}-${isMobile ? "m" : "d"}`, [isMobile]);

  const setRatio = useCallback((key: string, w: number, h: number) => {
    if (!w || !h) return;
    const r = w / h;
    setRatios((p) => (Math.abs((p[key] ?? 0) - r) < 0.001 ? p : { ...p, [key]: r }));
  }, []);

  useEffect(() => {
    if (count < 2 || igOpen) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % count), SLIDE_MS);
    return () => clearTimeout(t);
  }, [index, count, igOpen]);

  useEffect(() => {
    if (!igOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setIgOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [igOpen]);

  // Load the current and next photos ahead of time AND measure them, so the
  // hero already has the right shape when the slide appears.
  useEffect(() => {
    const targets = [ordered[index % (count || 1)], ordered[(index + 1) % (count || 1)]];
    targets.forEach((s) => {
      if (!s || parseVideoUrl(s.videoUrl)) return;
      const src = isMobile ? s.mobileImage || s.image : s.image;
      if (!src) return;
      const img = new Image();
      img.onload = () => setRatio(rk(s), img.naturalWidth, img.naturalHeight);
      img.src = resolveImage(src, isMobile ? 1200 : 1600);
    });
  }, [index, count, ordered, isMobile, rk, setRatio]);

  if (count === 0) return null;

  const active = index % count;
  const slide = ordered[active]!;
  latestId.current = slide.id;

  // The box keeps the OLD slide's shape until the old slide has faded out.
  const shownSlide = ordered.find((s) => s.id === shownId) ?? slide;
  const ratio = ratios[rk(shownSlide)] ?? DEFAULT_RATIO;

  const parsed = parseVideoUrl(slide.videoUrl);
  const bgVideo = parsed && parsed.kind !== "instagram" && !reduceMotion ? parsed : null;
  const igVideo = parsed?.kind === "instagram" ? parsed : null;

  return (
    <section
      className="relative w-full overflow-hidden bg-primary-deep pt-20 md:pt-0"
      style={isMobile ? undefined : { height: `min(85svh, ${100 / ratio}vw)` }}
    >
      {/* MEDIA */}
      <div
        className="relative w-full overflow-hidden transition-[aspect-ratio] duration-500 ease-out [container-type:size] md:absolute md:inset-0 md:h-full"
        style={isMobile ? { aspectRatio: ratio } : undefined}
      >
        <AnimatePresence mode="wait" onExitComplete={() => setShownId(latestId.current)}>
          <motion.div
            key={slide.id}
            variants={fade}
            initial="initial"
            animate="animate"
            exit="exit"
            className="absolute inset-0"
          >
            {bgVideo?.kind === "file" ? (
              <video
                key={bgVideo.src}
                src={bgVideo.src}
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                aria-hidden="true"
                onLoadedMetadata={(e) =>
                  setRatio(rk(slide), e.currentTarget.videoWidth, e.currentTarget.videoHeight)
                }
                className="absolute inset-0 h-full w-full object-contain md:object-cover"
              />
            ) : bgVideo?.kind === "youtube" ? (
              <iframe
                key={bgVideo.id}
                src={youtubeBackgroundUrl(bgVideo.id)}
                title=""
                aria-hidden="true"
                tabIndex={-1}
                allow="autoplay; encrypted-media"
                className="pointer-events-none absolute left-1/2 top-1/2 aspect-video w-[max(100cqw,177.78cqh)] -translate-x-1/2 -translate-y-1/2 border-0"
              />
            ) : (
              <picture className="absolute inset-0 block h-full w-full">
                <source media="(min-width: 768px)" srcSet={resolveImage(slide.image)} />
                <img
                  src={resolveImage(slide.mobileImage || slide.image, 1200)}
                  alt=""
                  fetchPriority="high"
                  decoding="async"
                  draggable={false}
                  onLoad={(e) =>
                    setRatio(rk(slide), e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)
                  }
                  className="h-full w-full object-contain object-center md:object-cover"
                />
              </picture>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* TEXT: below the picture on phones (designed panel), centred over it on desktop */}
      <div className="relative flex justify-center overflow-hidden border-t-2 border-accent bg-gradient-to-b from-primary-deep to-primary px-6 pb-12 pt-8 text-center md:absolute md:inset-0 md:items-center md:overflow-visible md:border-0 md:bg-none md:p-0">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--accent)_25%,transparent),transparent_70%)] md:hidden" />
        <AnimatePresence mode="wait">
          <motion.div
            key={`copy-${slide.id}`}
            variants={fade}
            initial="initial"
            animate="animate"
            exit="exit"
            className="relative w-full max-w-xl md:drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]"
          >
            {slide.eyebrow && (
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-accent sm:text-xs sm:tracking-[0.35em] md:text-white">
                {slide.eyebrow}
              </p>
            )}
            <h1 className="mt-3 text-2xl font-extrabold uppercase leading-tight tracking-wide text-white sm:mt-4 sm:text-3xl lg:text-5xl">
              {slide.title}
            </h1>
            {slide.ctaLabel && slide.ctaHref && (
              <div className="mt-6 md:mt-8">
                <ButtonLink href={slide.ctaHref} variant="outline">
                  {slide.ctaLabel}
                </ButtonLink>
              </div>
            )}
            {igVideo && (
              <button
                type="button"
                onClick={() => setIgOpen(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/25"
              >
                <Play className="h-4 w-4 fill-current" />
                Watch video
              </button>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {count > 1 && (
        <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2 md:bottom-6">
          {ordered.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-label={`Show slide ${i + 1}`}
              onClick={() => setIndex(i)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === active ? "w-8 bg-white" : "w-4 bg-white/50 hover:bg-white/80",
              )}
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {igVideo && igOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIgOpen(false)}
            className="fixed inset-0 z-[70] grid place-items-center bg-black/80 p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative h-[min(85svh,720px)] w-[min(92vw,420px)]"
            >
              <iframe
                src={igVideo.embedUrl}
                title="Instagram video"
                allowFullScreen
                className="h-full w-full rounded-2xl border-0 bg-white"
              />
              <button
                type="button"
                onClick={() => setIgOpen(false)}
                aria-label="Close video"
                className="absolute -top-12 right-0 grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}