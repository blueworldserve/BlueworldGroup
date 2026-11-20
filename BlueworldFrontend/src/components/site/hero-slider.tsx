import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Play, X } from "lucide-react";
import { AppLink } from "@/components/site/app-link";
import { ButtonLink } from "@/components/site/primitives";
import { resolveImage } from "@/data/images";
import { parseVideoUrl, youtubeBackgroundUrl } from "@/lib/video";
import type { HeroSlide } from "@/lib/types";
import { cn } from "@/lib/utils";

const SLIDE_MS = 7000;
/** A finger must travel at least this many pixels sideways, and mostly sideways, to count as a swipe. */
const SWIPE_MIN_PX = 45;

export type HeroCard = { title: string; image: string; href: string };
export type HeroStat = { k: string; v: string };

const PRODUCTS_BTN =
  "inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-[0.74rem] font-bold uppercase tracking-[0.16em] text-accent-foreground shadow-lg shadow-black/25 transition hover:-translate-y-0.5 hover:bg-white hover:text-primary-deep";

/** True from the `md` breakpoint (768px) up. False on the server and on phones. */
function useIsWide(): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return wide;
}

export function HeroSlider({
  slides,
  cards = [],
  stats = [],
}: {
  slides: HeroSlide[];
  cards?: HeroCard[];
  stats?: HeroStat[];
}) {
  const ordered = useMemo(() => [...slides].sort((a, b) => a.order - b.order), [slides]);
  const count = ordered.length;
  const [index, setIndex] = useState(0);
  const [igOpen, setIgOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const isWide = useIsWide();

  // Swipe to change slide (phones and tablets). `direction` makes the new slide arrive from the side the finger moved toward.
  const direction = useRef<1 | -1>(1);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const go = useCallback(
    (step: 1 | -1) => {
      direction.current = step;
      setIndex((i) => (i + step + count) % count);
    },
    [count],
  );
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = t ? { x: t.clientX, y: t.clientY } : null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    const t = e.changedTouches[0];
    if (!start || !t || count < 2 || igOpen) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // Mostly sideways only, so scrolling the page up and down never flips the slide.
    if (Math.abs(dx) >= SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
  };

  // A timeout keyed on `index` (not an interval) so clicking a dot restarts
  // the countdown instead of the next auto-advance firing a moment later.
  useEffect(() => {
    if (count < 2 || igOpen) return; // hold the slide while an Instagram video is open
    const t = setTimeout(() => {
      direction.current = 1;
      setIndex((i) => (i + 1) % count);
    }, SLIDE_MS);
    return () => clearTimeout(t);
  }, [index, count, igOpen]);

  useEffect(() => {
    if (!igOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setIgOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [igOpen]);

  // Warm the next slide's images so the crossfade never shows a blank frame.
  useEffect(() => {
    if (count < 2) return;
    const next = ordered[(index + 1) % count];
    if (!next) return;
    [next.image, next.mobileImage].forEach((src) => {
      if (!src) return;
      const img = new Image();
      img.src = resolveImage(src);
    });
  }, [index, count, ordered]);

  if (count === 0) return null;

  const active = index % count;
  const slide = ordered[active]!;

  const mobileSrc = slide.mobileImage || slide.image;
  const mobileIsRemote = /^https?:\/\//.test(mobileSrc);
  const parsed = isWide ? parseVideoUrl(slide.videoUrl) : null;
  const bgVideo = parsed && parsed.kind !== "instagram" && !reduceMotion ? parsed : null;
  const igVideo = parsed?.kind === "instagram" ? parsed : null;
  const showSlideCta = Boolean(slide.ctaLabel && slide.ctaHref && slide.ctaHref !== "/products");

  return (
    <section
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={() => (touchStart.current = null)}
      className="relative aspect-[9/16] max-h-[88svh] w-full touch-pan-y overflow-hidden bg-primary-deep md:aspect-auto md:h-[94vh] md:max-h-none"
    >
      <AnimatePresence mode="sync">
        <motion.div
          key={slide.id}
          initial={{ opacity: 0, scale: 1.04, x: reduceMotion ? 0 : direction.current * 36 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          <picture>
            <source media="(min-width: 768px)" srcSet={resolveImage(slide.image)} />
            <img
              src={resolveImage(mobileSrc, 1200)}
              srcSet={
                mobileIsRemote
                  ? `${resolveImage(mobileSrc, 800)} 800w, ${resolveImage(mobileSrc, 1200)} 1200w, ${resolveImage(mobileSrc, 1600)} 1600w`
                  : undefined
              }
              sizes="100vw"
              alt=""
              fetchPriority="high"
              decoding="async"
              draggable={false}
              className="absolute inset-0 h-full w-full object-cover object-[50%_22%] saturate-[1.12] contrast-[1.05] md:object-[50%_30%]"
            />
          </picture>
          {bgVideo?.kind === "file" && (
            <video
              key={bgVideo.src}
              src={bgVideo.src}
              poster={resolveImage(slide.image)}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover saturate-[1.12] contrast-[1.05]"
            />
          )}
          {bgVideo?.kind === "youtube" && (
            <iframe
              key={bgVideo.id}
              src={youtubeBackgroundUrl(bgVideo.id)}
              title=""
              aria-hidden="true"
              tabIndex={-1}
              allow="autoplay; encrypted-media"
              className="pointer-events-none absolute left-1/2 top-1/2 aspect-video w-[max(100%,177.78svh)] -translate-x-1/2 -translate-y-1/2 border-0"
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Desktop: dark only where the text sits (left) and behind the stats bar (bottom), so the photo stays vivid. */}
      <div className="pointer-events-none absolute inset-0 hidden bg-gradient-to-r from-black/60 via-black/15 to-transparent md:block" />
      <div className="pointer-events-none absolute inset-0 hidden bg-gradient-to-t from-black/50 via-transparent to-transparent md:block" />
      {/* Phones */}
      <div className="pointer-events-none absolute inset-0 bg-black/35 md:hidden" />

      {slide.ctaHref && !slide.ctaLabel && (
        <AppLink href={slide.ctaHref} className="absolute inset-0 z-[5] md:hidden">
          <span className="sr-only">{slide.title}</span>
        </AppLink>
      )}

      {/* Phones: caption at the bottom */}
      <div className="pointer-events-none absolute inset-0 z-[6] flex items-center justify-center px-6 text-center md:hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={`m-copy-${slide.id}`}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-sm"
          >
            {slide.eyebrow && (
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-white/85">{slide.eyebrow}</p>
            )}
            <h1 className="mt-2 line-clamp-3 text-[1.65rem] font-extrabold uppercase leading-[1.15] tracking-wide text-white [text-shadow:0_1px_14px_rgba(0,0,0,0.35)]">
              {slide.title}
            </h1>
            <div className="pointer-events-auto mt-5 flex flex-col items-center gap-3">
              <AppLink href="/products" className={PRODUCTS_BTN}>
                See products <ArrowRight className="h-4 w-4" />
              </AppLink>
              {showSlideCta && (
                <ButtonLink href={slide.ctaHref} variant="outline">
                  {slide.ctaLabel}
                </ButtonLink>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Wide screens: left-aligned caption, brand cards on the right */}
      <div className="relative hidden h-full md:block">
        <div
          className={cn(
            "mx-auto flex h-full max-w-7xl items-center justify-between gap-10 px-8 pt-28",
            stats.length > 0 ? "pb-32" : "pb-20",
          )}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={`copy-${slide.id}`}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.6 }}
              className="max-w-xl text-left"
            >
              {slide.eyebrow && (
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/85">{slide.eyebrow}</p>
              )}
              <h1 className="mt-4 text-4xl font-extrabold uppercase leading-[1.05] tracking-wide text-white [text-shadow:0_2px_20px_rgba(0,0,0,0.3)] lg:text-6xl">
                {slide.title}
              </h1>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <AppLink href="/products" className={PRODUCTS_BTN}>
                  See products <ArrowRight className="h-4 w-4" />
                </AppLink>
                {showSlideCta && (
                  <ButtonLink href={slide.ctaHref} variant="outline">
                    {slide.ctaLabel}
                  </ButtonLink>
                )}
                {igVideo && (
                  <button
                    type="button"
                    onClick={() => setIgOpen(true)}
                    className="inline-flex items-center gap-2 rounded-full bg-white/15 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/25"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    Watch video
                  </button>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          {cards.length > 0 && (
            <div className="hidden w-64 shrink-0 flex-col gap-4 lg:flex">
              {cards.slice(0, 2).map((c, i) => (
                <AppLink
                  key={c.href}
                  href={c.href}
                  className={cn(
                    "group flex gap-3 rounded-2xl p-3 shadow-xl shadow-black/30 transition duration-300 hover:-translate-y-1",
                    i === 0 ? "bg-accent text-accent-foreground" : "bg-primary-deep text-white",
                  )}
                >
                  <img
                    src={resolveImage(c.image, 400)}
                    alt=""
                    draggable={false}
                    className="h-24 w-24 shrink-0 rounded-xl object-cover"
                  />
                  <span className="flex flex-col justify-between py-1">
                    <span className="text-base font-bold leading-tight">{c.title}</span>
                    <span className="text-xs font-semibold underline underline-offset-4">Explore</span>
                  </span>
                </AppLink>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Wide screens: stats bar. Columns always split the width evenly, whatever the count. */}
      {stats.length > 0 && (
        <div className="absolute inset-x-0 bottom-0 z-10 hidden px-8 pb-4 md:block">
          <div className="mx-auto max-w-5xl rounded-xl border border-white/20 bg-primary-deep/55 py-3 backdrop-blur-xl">
            <div
              className="grid divide-x divide-white/15"
              style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}
            >
              {stats.map((s) => (
                <div key={s.v} className="px-3 text-center">
                  <p className="bw-accent bw-orange text-xl">{s.k}</p>
                  <p className="mt-0.5 text-[0.55rem] uppercase tracking-[0.16em] text-white/75">{s.v}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {count > 1 && (
        <div
          className={cn(
            "absolute left-1/2 z-10 flex -translate-x-1/2 gap-2",
            "bottom-5",
            stats.length > 0 ? "md:bottom-24" : "md:bottom-6",
          )}
        >
          {ordered.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-label={`Show slide ${i + 1}`}
              onClick={() => {
                direction.current = i >= active ? 1 : -1;
                setIndex(i);
              }}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === active ? "w-8 bg-white" : "w-4 bg-white/40 hover:bg-white/70",
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
            <div onClick={(e) => e.stopPropagation()} className="relative h-[min(85svh,720px)] w-[min(92vw,420px)]">
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