import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Play, X } from "lucide-react";
import { ButtonLink } from "@/components/site/primitives";
import { resolveImage } from "@/data/images";
import { parseVideoUrl, youtubeBackgroundUrl } from "@/lib/video";
import type { HeroSlide } from "@/lib/types";
import { cn } from "@/lib/utils";

const SLIDE_MS = 7000;

export function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const ordered = useMemo(() => [...slides].sort((a, b) => a.order - b.order), [slides]);
  const count = ordered.length;
  const [index, setIndex] = useState(0);
  const [igOpen, setIgOpen] = useState(false);
  const reduceMotion = useReducedMotion();

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

  // YouTube and file videos play as a muted background; Instagram can't autoplay
  // or hide its chrome, so it gets a "Watch video" button that opens the embed.
  const parsed = parseVideoUrl(slide.videoUrl);
  const bgVideo = parsed && parsed.kind !== "instagram" && !reduceMotion ? parsed : null;
  const igVideo = parsed?.kind === "instagram" ? parsed : null;

  return (
    <section className="relative h-[82svh] min-h-[520px] w-full overflow-hidden bg-primary-deep md:h-[92vh]">
      {/* One photo at a time. <picture> lets the browser pick the right file
          for the screen and only download that one: the slide's main photo
          from 768px up, its mobile photo below that (falling back to the main
          photo if no mobile one was uploaded). */}
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
              src={resolveImage(slide.mobileImage || slide.image)}
              alt=""
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

      {/* Legibility scrims. The mobile one is heavier at the bottom because
          the text sits there on phones. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-black/5 to-black/35" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent md:hidden" />

      {/* Phones: text is anchored to the bottom so the model's face stays
          clear, with room left for the dots. md and up: centered as before. */}
      <div className="relative flex h-full items-end justify-center px-6 pb-20 text-center md:items-center md:pb-0">
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
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-white/85 sm:text-xs sm:tracking-[0.35em]">
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
        <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 gap-2">
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