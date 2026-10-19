import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Play, X } from "lucide-react";
import { AppLink } from "@/components/site/app-link";
import { ButtonLink } from "@/components/site/primitives";
import { resolveImage } from "@/data/images";
import { parseVideoUrl, youtubeBackgroundUrl } from "@/lib/video";
import type { HeroSlide } from "@/lib/types";
import { cn } from "@/lib/utils";

const SLIDE_MS = 7000;

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

export function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const ordered = useMemo(() => [...slides].sort((a, b) => a.order - b.order), [slides]);
  const count = ordered.length;
  const [index, setIndex] = useState(0);
  const [igOpen, setIgOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const isWide = useIsWide();

  // A timeout keyed on `index` (not an interval) so clicking a dot restarts
  // the countdown instead of the next auto-advance firing a moment later.
  useEffect(() => {
    if (count < 2 || igOpen) return; // hold the slide while an Instagram video is open
    const t = setTimeout(() => setIndex((i) => (i + 1) % count), SLIDE_MS);
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

  // Videos are for wide screens only. On phones the slide is just its photo
  // (nothing is downloaded or played). YouTube and file videos play as a muted
  // background; Instagram can't autoplay or hide its chrome, so it gets a
  // "Watch video" button that opens the embed.
  const parsed = isWide ? parseVideoUrl(slide.videoUrl) : null;
  const bgVideo = parsed && parsed.kind !== "instagram" && !reduceMotion ? parsed : null;
  const igVideo = parsed?.kind === "instagram" ? parsed : null;

  return (
    <section className="relative aspect-[9/16] max-h-[88svh] w-full overflow-hidden bg-primary-deep md:aspect-auto md:h-[92vh] md:max-h-none">
      {/* One photo at a time. On a phone the box is phone-shaped (9:16) and the
          photo fills it edge to edge: `object-cover` scales it up if it's small
          and crops whatever overflows if it's a different shape. From 768px up
          the slide's main (wide) photo is used instead. */}
      <AnimatePresence mode="sync">
        <motion.div
          key={slide.id}
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          <picture>
            <source media="(min-width: 768px)" srcSet={resolveImage(slide.image)} />
            <img
              src={resolveImage(slide.mobileImage || slide.image, 900)}
              alt=""
              fetchPriority="high"
              decoding="async"
              draggable={false}
              className="absolute inset-0 h-full w-full object-cover object-[50%_22%] md:object-[50%_30%]"
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
              className="absolute inset-0 h-full w-full object-cover"
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

      {/* Desktop legibility scrim for the centered text. Phones show the photo as-is. */}
      <div className="pointer-events-none absolute inset-0 hidden bg-gradient-to-b from-black/25 via-black/5 to-black/35 md:block" />
      {/* Phones: a faint fade behind the dots only, so they stay visible on bright photos. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/35 to-transparent md:hidden" />

      {/* Phones: no caption panel. The heading stays in the page for screen readers
          and search engines, and tapping the photo follows the slide's link. */}
      <h1 className="sr-only md:hidden">{slide.title}</h1>
      {slide.ctaHref && (
        <AppLink href={slide.ctaHref} className="absolute inset-0 z-[5] md:hidden">
          <span className="sr-only">{slide.ctaLabel || slide.title}</span>
        </AppLink>
      )}

      {/* Wide screens: centered caption over the photo or video. */}
      <div className="relative hidden h-full items-center justify-center px-6 text-center md:flex">
        <AnimatePresence mode="wait">
          <motion.div
            key={`copy-${slide.id}`}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.6 }}
            className="w-full max-w-xl"
          >
            {slide.eyebrow && (
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/85">{slide.eyebrow}</p>
            )}
            <h1 className="mt-4 text-3xl font-extrabold uppercase leading-tight tracking-wide text-white lg:text-5xl">
              {slide.title}
            </h1>
            {slide.ctaLabel && slide.ctaHref && (
              <div className="mt-8">
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
        <div className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 gap-2 md:bottom-6">
          {ordered.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-label={`Show slide ${i + 1}`}
              onClick={() => setIndex(i)}
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