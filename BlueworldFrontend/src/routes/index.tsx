import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import { Globe2, MapPin, X } from "lucide-react";
import { HeroSlider } from "@/components/site/hero-slider";
import { AppLink } from "@/components/site/app-link";
import { BrandGlobe } from "@/components/brand/brand-globe";
import {
  CmsImage,
  EmptyBlock,
  LoadingBlock,
  Section,
  SectionHeading,
} from "@/components/site/primitives";
import { useBlogPosts, useBusinessUnits, useHeroSlides, useProducts } from "@/hooks/use-cms";
import { ENDPOINTS, submitWithMock } from "@/lib/api";
import { REACH_MARKERS } from "@/data/placeholder-content";
import { HeroFlag } from "@/components/site/hero-context";
import { ScrollRevealText } from "@/components/site/scroll-reveal-text";
import { useCollection } from "@/lib/cms-store";
import type { Product } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Blue World Cosmetics — Nigerian Cosmetics Manufacturer" },
      {
        name: "description",
        content:
          "Skincare, hygiene, haircare and fragrance manufactured in Lagos. Home of Vivon, BlueCrystal, Blow Right, BlueFragrance and BlueWorld Cosmetics.",
      },
      { property: "og:title", content: "Blue World Cosmetics" },
      {
        property: "og:description",
        content: "Five brands. One Nigerian manufacturing house. God Is Our Strength.",
      },
    ],
  }),
  component: HomePage,
});

const BUSINESS_UNIT_DISPLAY_ORDER = [
  "vivon",
  "bluefragrance",
  "blueworld-cosmetics",
  "bluecrystal",
  "blow-right",
];

function orderBusinessUnits<T extends { slug: string }>(units: T[]): T[] {
  return [...units].sort((a, b) => {
    const ai = BUSINESS_UNIT_DISPLAY_ORDER.indexOf(a.slug);
    const bi = BUSINESS_UNIT_DISPLAY_ORDER.indexOf(b.slug);
    const aRank = ai === -1 ? BUSINESS_UNIT_DISPLAY_ORDER.length : ai;
    const bRank = bi === -1 ? BUSINESS_UNIT_DISPLAY_ORDER.length : bi;
    return aRank - bRank;
  });
}

const TRUST_MARKERS = [
  { k: "2016", v: "Founded in Lagos" },
  { k: "500+", v: "People employed" },
  { k: "5", v: "Brands in the house" },
  { k: "120+", v: "SKUs in production" },
  { k: "9", v: "Countries reached" },
  { k: "11", v: "QC checks per batch" },
];

function HomePage() {
  const slides = useHeroSlides();
  const units = useBusinessUnits();
  const products = useProducts();
  const posts = useBlogPosts();
  const countryShowcases = useCollection("countryShowcases");
  const [activeCountry, setActiveCountry] = useState<string | null>(null);
  const [openProduct, setOpenProduct] = useState<Product | null>(null);
  const activeShowcase = activeCountry
    ? countryShowcases.find((s) => s.name.toLowerCase() === activeCountry.toLowerCase()) ?? null
    : null;

  const orderedUnits = orderBusinessUnits(units.data ?? []);
  const latest = (posts.data ?? []).slice(0, 3);

  // Up to 8 products: featured ones first choice, otherwise fall back to the whole catalogue
  // so the marquee is never empty just because nothing has been flagged "featured" yet.
  const marqueePool = useMemo(() => {
    const all = products.data ?? [];
    const featuredOnly = all.filter((p) => p.featured);
    const base = featuredOnly.length >= 4 ? featuredOnly : all;
    return base.slice(0, 8);
  }, [products.data]);
  const half = Math.ceil(marqueePool.length / 2);
  const topRow = marqueePool.slice(0, half);
  const bottomRow = marqueePool.slice(half);

  return (
    <>
      <HeroFlag />
      {slides.isLoading ? (
        <div className="h-[70vh] animate-pulse bg-primary-deep" />
      ) : (
        <HeroSlider slides={slides.data ?? []} />
      )}

      {/* Trust bar — sits right under the hero, gives the page immediate
          substance instead of dropping straight into a big empty gap. */}
      <div className="border-b border-border bg-primary-deep py-6">
        <div className="mx-auto grid max-w-7xl grid-cols-3 gap-4 px-5 sm:gap-6 sm:grid-cols-6 lg:px-8">
          {TRUST_MARKERS.map((s) => (
            <div key={s.k} className="min-w-0 text-center">
              <p className="font-display text-xl font-extrabold text-accent sm:text-2xl">{s.k}</p>
              <p className="mt-1 text-[0.6rem] font-semibold uppercase tracking-wide text-primary-foreground/70 sm:text-[0.65rem]">
                {s.v}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Globe section — click a marker on the globe, or a chip below it,
          to see that market's photo backdrop and write-up in the right
          card. Click the X on the globe (or "Overview" on the right) to
          reset back to the deep-blue default. */}
      <Section tone="muted" className="py-12 lg:py-16">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="mb-10 sm:mb-12"
        >
          {/* Lines flank the text only from sm up — on phones they were
              squeezing the words into an awkward wrap. Below sm it's just
              centered text, full width, properly sized down. */}
          <div className="hidden items-center justify-center gap-4 sm:flex">
            <span className="h-px w-8 bg-accent md:w-12" />
            <ScrollRevealText
              text="God Is Our Strength"
              className="whitespace-nowrap text-2xl font-semibold uppercase leading-none tracking-[0.06em] text-primary-deep md:text-3xl"
            />
            <span className="h-px w-8 bg-accent md:w-12" />
          </div>
          <div className="sm:hidden">
            <ScrollRevealText
              text="God Is Our Strength"
              className="text-center text-lg font-semibold uppercase leading-snug tracking-[0.04em] text-primary-deep"
            />
          </div>
        </motion.div>

        {/* items-stretch: if either card's content runs slightly longer than
            the other's, the shorter one stretches to match, instead of the
            two drifting apart the way they did with items-start. */}
        <div className="grid items-stretch gap-5 lg:grid-cols-2 lg:gap-6">
          {/* Card A — globe, height-capped (boxHeightClass) so it no longer
              dictates the row's height on its own. A row of country chips
              underneath fills the leftover space with real, useful content
              (and doubles as a second, easier way to trigger the same
              select-a-country interaction as clicking a pin on the globe). */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="flex flex-col rounded-3xl border border-border bg-card p-4 shadow-card sm:p-5 lg:p-6"
          >
            <p className="eyebrow">Where we ship</p>
            <h3 className="mt-2 font-display text-lg font-bold text-primary-deep sm:text-xl">
              Made in Nigeria, carried around the world
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              From our plant on Oba Akran Avenue, Blue World products reach households across four
              countries. Tap a marker — or a market below — to see it up close.
            </p>

            <div className="mt-4">
              <BrandGlobe
                markers={REACH_MARKERS}
                maxWidthClass="max-w-none"
                background="midnight"
                standText={null}
                activeCountry={activeCountry}
                onSelectCountry={(name) => setActiveCountry(name || null)}
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {REACH_MARKERS.map((m) => {
                const active = activeCountry?.toLowerCase() === m.name.toLowerCase();
                return (
                  <button
                    key={m.name}
                    type="button"
                    onClick={() => setActiveCountry(active ? null : m.name)}
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors ${
                      active
                        ? "border-transparent bg-accent text-accent-foreground"
                        : "border-border text-primary-deep hover:bg-primary-soft"
                    }`}
                  >
                    {m.name}
                  </button>
                );
              })}
            </div>
          </motion.div>

          {/* Card B: on desktop it can never be taller than Card A. Its content
              sits in an absolutely-positioned area, so only Card A decides the
              row height and this card fills it. Content starts at the top and the
              rows stretch to use the space. On mobile it stacks normally. */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
            className="relative rounded-3xl border border-border bg-card shadow-card"
          >
            <div className="flex h-full flex-col p-4 sm:p-5 lg:absolute lg:inset-0 lg:overflow-y-auto lg:p-6">
              <AnimatePresence mode="wait">
                {activeShowcase ? (
                  <motion.div
                    key={activeCountry}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-1 flex-col"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="eyebrow">{activeShowcase.place}</p>
                        <h3 className="mt-2 font-display text-lg font-bold text-primary-deep sm:text-xl">
                          {activeShowcase.headline}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveCountry(null)}
                        className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-bold text-primary-deep hover:bg-primary-soft"
                      >
                        ← Overview
                      </button>
                    </div>

                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{activeShowcase.blurb}</p>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{activeShowcase.detail}</p>

                    <div className="mt-4 flex items-center gap-3 rounded-2xl bg-accent-soft p-4">
                      <span className="font-display text-2xl font-extrabold text-accent">
                        {activeShowcase.statValue}
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-wide text-primary-deep/70">
                        {activeShowcase.statLabel}
                      </span>
                    </div>

                    {/* Each point is its own row and the rows share the leftover
                        height evenly, so the list starts at the top and fills
                        the card instead of clumping in the middle. */}
                    <div className="mt-3 flex flex-1 flex-col rounded-2xl border border-border px-4">
                      {activeShowcase.points.map((point) => (
                        <div
                          key={point}
                          className="flex min-h-[2.25rem] flex-1 items-center gap-2 border-b border-border py-2 text-sm font-semibold text-primary-deep last:border-b-0"
                        >
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                          {point}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="overview"
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-1 flex-col"
                  >
                    <p className="eyebrow">Every marker, explained</p>
                    <h3 className="mt-2 font-display text-lg font-bold text-primary-deep sm:text-xl">
                      Four markets, one factory floor
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      Five Nigerian-made brands, trusted in homes across four countries and counting.
                    </p>

                    <div className="mt-4 flex flex-1 flex-col rounded-2xl bg-accent-soft p-4 sm:p-5">
                      <div className="flex items-center gap-2 border-b border-primary-deep/10 pb-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-deep/10">
                          <Globe2 size={16} className="text-primary-deep" />
                        </span>
                        <span className="text-xs font-bold uppercase tracking-[0.14em] text-primary-deep/70">
                          Export map
                        </span>
                      </div>

                      {/* Rows are flex-1, so on desktop they stretch to fill the
                          card's height from the top down. Each row now carries
                          the city, a two-line summary and a headline number
                          from the country's CMS entry. */}
                      <div className="mt-4 flex flex-1 flex-col gap-2.5">
                        {REACH_MARKERS.map((m) => {
                          const s = countryShowcases.find((c) => c.name.toLowerCase() === m.name.toLowerCase());
                          return (
                            <motion.button
                              key={m.name}
                              type="button"
                              onClick={() => setActiveCountry(m.name)}
                              whileHover={{ scale: 1.02, y: -2 }}
                              transition={{ type: "spring", stiffness: 300, damping: 20 }}
                              className="flex min-h-[4rem] flex-1 items-center gap-3 rounded-xl bg-card/70 px-3.5 py-2.5 text-left shadow-sm"
                            >
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15">
                                <MapPin size={14} className="text-accent" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex items-baseline gap-2">
                                  <span className="font-display text-sm font-bold text-primary-deep">{m.name}</span>
                                  {s?.place && (
                                    <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-accent">
                                      {s.place}
                                    </span>
                                  )}
                                </span>
                                <span className="mt-0.5 block text-xs text-muted-foreground">{m.note}</span>
                              </span>
                              {s && (
                                <span className="shrink-0 text-right">
                                  <span className="block font-display text-lg font-extrabold leading-none text-accent">
                                    {s.statValue}
                                  </span>
                                  <span className="mt-1 block text-[0.6rem] font-semibold uppercase tracking-wide text-primary-deep/60">
                                    {s.statLabel}
                                  </span>
                                </span>
                              )}
                            </motion.button>
                          );
                        })}
                      </div>

                      <p className="mt-3 border-t border-primary-deep/10 pt-3 text-center text-xs font-semibold text-primary-deep/60">
                        {REACH_MARKERS.length} export markets and counting
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </Section>

      {/* Business units — plain white, image-forward (Nuban-style), no chrome */}
      <Section className="py-12 lg:py-16">
        <SectionHeading
          eyebrow="Our business"
          title="Five brands, built for different shelves"
          description="Each unit runs its own formulation brief, packaging language and route to market — sharing one factory floor and one quality standard."
        />
        <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-3 lg:gap-x-6">
          {units.isLoading && <LoadingBlock label="Loading business units…" />}
          {!units.isLoading && orderedUnits.length === 0 && (
            <EmptyBlock label="No business units published yet." />
          )}
          {orderedUnits.map((unit, i) => (
            <motion.div
              key={unit.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.45, delay: i * 0.05 }}
            >
              <AppLink href={`/business/${unit.slug}`} className="group block">
                <div className="relative aspect-[4/5] overflow-hidden bg-secondary">
                  <CmsImage
                    src={unit.heroImage}
                    alt={unit.name}
                    className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                  />
                  {/* Bellussi-style diagonal shine — sweeps across on hover */}
                  <div
                    className="pointer-events-none absolute inset-0 -translate-x-[150%] skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-[1100ms] ease-out group-hover:translate-x-[150%]"
                  />
                  {/* Bottom scrim so the reveal text below is always legible */}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/50 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                </div>
                <div className="mt-3 text-center">
                  <p className="font-serif text-xs italic tracking-wide text-muted-foreground">Collection</p>
                  <h3 className="mt-1 font-display text-base font-bold text-primary-deep">{unit.name}</h3>
                  <p className="mt-1 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-accent">
                    {unit.tagline}
                  </p>
                  {/* Hover reveal — hidden until hover, like Bellussi's "you discover" */}
                  <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-500 ease-out group-hover:grid-rows-[1fr]">
                    <div className="overflow-hidden">
                      <p className="mx-auto mt-3 max-w-xs text-xs leading-relaxed text-muted-foreground">
                        {unit.summary}
                      </p>
                      <span className="mt-3 inline-block border-b border-accent pb-0.5 text-[0.6rem] font-bold uppercase tracking-[0.16em] text-accent">
                        Discover
                      </span>
                    </div>
                  </div>
                </div>
              </AppLink>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* Featured products — two slow-drifting rows (top → right, bottom → left).
          Hover pauses the row and reveals the shine + description; click opens the
          full product view. Orange-tinted background warms up the page between two
          otherwise-white sections. */}
      <Section tone="warm" className="py-12 lg:py-16">
        <SectionHeading eyebrow="Featured products" title="What our lines are shipping right now" />
        <style>{MARQUEE_CSS}</style>
        <div className="mt-10 space-y-4">
          {products.isLoading && <LoadingBlock label="Loading products…" />}
          {!products.isLoading && marqueePool.length === 0 && (
            <EmptyBlock label="No products published yet." />
          )}
          <ProductRow items={topRow} direction="right" secondsPerTile={6} onOpen={setOpenProduct} />
          <ProductRow items={bottomRow} direction="left" secondsPerTile={5.5} onOpen={setOpenProduct} />
        </div>
      </Section>

      {/* Quote strip — cheap to build, gives the page a confident, considered
          moment instead of jumping straight from products to blog. */}
      <Section className="py-12 lg:py-14">
        <blockquote className="mx-auto max-w-3xl text-center">
          <p className="font-display text-xl font-bold leading-snug text-primary-deep sm:text-2xl">
            "Make it properly, or do not ship it."
          </p>
          <footer className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-accent">
            The rule since 1998
          </footer>
        </blockquote>
      </Section>

      {/* Latest posts */}
      <Section tone="muted" className="py-12 lg:py-16">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading eyebrow="From the blog" title="News, research and factory notes" />
          <AppLink
            href="/blog"
            className="rounded-full border-2 border-primary px-5 py-2.5 text-sm font-bold text-primary-deep transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            All posts
          </AppLink>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {latest.map((post) => (
            <AppLink
              key={post.id}
              href={`/blog/${post.slug}`}
              className="group block overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-all hover:-translate-y-1 hover:shadow-lift"
            >
              <div className="aspect-[16/10] overflow-hidden">
                <CmsImage
                  src={post.coverImage}
                  alt={post.title}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>
              <div className="p-5">
                <p className="eyebrow">{post.category}</p>
                <h3 className="mt-2 text-base font-bold leading-snug text-primary-deep">
                  {post.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{post.excerpt}</p>
              </div>
            </AppLink>
          ))}
        </div>
      </Section>

      <NewsletterBlock />

      <AnimatePresence>
        {openProduct && (
          <ProductDetail
            key={openProduct.id}
            product={openProduct}
            onClose={() => setOpenProduct(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Featured products: marquee rows + detail overlay                    */
/* ------------------------------------------------------------------ */

// Every row's track is [set, set] and slides exactly one set's width (-50%),
// so the loop is seamless. Tiles use margin-right (not flex gap) so both sets
// are precisely the same width. Reduced-motion users get a still row.
const MARQUEE_CSS = `
@keyframes bw-marquee-left  { from { transform: translateX(0); }    to { transform: translateX(-50%); } }
@keyframes bw-marquee-right { from { transform: translateX(-50%); } to { transform: translateX(0); } }
@media (prefers-reduced-motion: reduce) { .bw-marquee-track { animation: none !important; } }
`;

// A set needs to be wider than the widest screen, otherwise a gap opens at the
// right edge mid-loop — so short product lists get repeated up to this many tiles.
const MIN_TILES_PER_SET = 12;

function ProductRow({
  items,
  direction,
  secondsPerTile,
  onOpen,
}: {
  items: Product[];
  direction: "left" | "right";
  secondsPerTile: number;
  onOpen: (product: Product) => void;
}) {
  const [paused, setPaused] = useState(false);

  const filled = useMemo(() => {
    if (items.length === 0) return [];
    const reps = Math.max(1, Math.ceil(MIN_TILES_PER_SET / items.length));
    return Array.from({ length: reps }).flatMap(() => items);
  }, [items]);

  if (filled.length === 0) return null;

  const track = [...filled, ...filled];
  const duration = filled.length * secondsPerTile;
  const fade = "linear-gradient(to right, transparent, black 5%, black 95%, transparent)";

  return (
    <div
      className="overflow-x-clip"
      style={{ maskImage: fade, WebkitMaskImage: fade }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="bw-marquee-track flex w-max"
        style={{
          animation: `${direction === "left" ? "bw-marquee-left" : "bw-marquee-right"} ${duration}s linear infinite`,
          animationPlayState: paused ? "paused" : "running",
        }}
      >
        {track.map((p, i) => (
          <ProductTile
            key={`${p.id}-${i}`}
            product={p}
            duplicate={i >= filled.length}
            onOpen={onOpen}
          />
        ))}
      </div>
    </div>
  );
}

function ProductTile({
  product,
  duplicate,
  onOpen,
}: {
  product: Product;
  duplicate: boolean;
  onOpen: (product: Product) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(product)}
      aria-hidden={duplicate}
      tabIndex={duplicate ? -1 : 0}
      className="group mr-3 block w-40 shrink-0 text-left sm:w-48 lg:w-56"
    >
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-secondary">
        <CmsImage
          src={product.image}
          alt={product.name}
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
        />
        {/* Same diagonal shine as the business-unit cards */}
        <div className="pointer-events-none absolute inset-0 -translate-x-[150%] skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-[1100ms] ease-out group-hover:translate-x-[150%]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/40 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      </div>

      <div className="mt-3 px-1">
        <p className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-accent">
          {product.category} · {product.size}
        </p>
        <h3 className="mt-1 truncate font-display text-base font-bold text-primary-deep">
          {product.name}
        </h3>
        {/* Fixed-height slot: the hint fades out and the description fades in, in the
            same space — so hovering never changes the tile's height and the rows
            below never jump. */}
        <div className="relative mt-1.5 h-[3.7rem]">
          <span className="absolute left-0 top-0 inline-block border-b border-accent pb-0.5 text-[0.6rem] font-bold uppercase tracking-[0.16em] text-accent transition-opacity duration-300 group-hover:opacity-0">
            View details
          </span>
          <p className="absolute inset-0 line-clamp-3 translate-y-2 text-xs leading-relaxed text-muted-foreground opacity-0 transition-all duration-500 ease-out group-hover:translate-y-0 group-hover:opacity-100">
            {product.description}
          </p>
        </div>
      </div>
    </button>
  );
}

function ProductDetail({ product, onClose }: { product: Product; onClose: () => void }) {
  // Esc closes, and the page behind stops scrolling while the overlay is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const facts = [
    { label: "Category", value: product.category },
    { label: "Pack size", value: product.size },
    { label: "Made in", value: "Lagos, Nigeria" },
  ];

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={product.name}
      className="fixed inset-0 z-[70] overflow-y-auto text-white"
      style={{
        background:
          "radial-gradient(ellipse at 18% 28%, rgba(245,166,35,0.30), transparent 55%), radial-gradient(ellipse at 85% 95%, rgba(238,138,30,0.18), transparent 50%), linear-gradient(160deg, #0d3170 0%, #0a2250 55%, #071838 100%)",
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close product"
        className="fixed right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20 sm:right-6 sm:top-6"
      >
        <X size={18} />
      </button>

      <div className="mx-auto grid min-h-full max-w-7xl lg:grid-cols-2">
        {/* Left — the product, on a glowing orange-tinted blue stage */}
        <div className="relative flex items-center justify-center px-6 pb-6 pt-20 lg:px-12 lg:py-16">
          <div className="pointer-events-none absolute aspect-square w-[70%] max-w-md rounded-full bg-accent/25 blur-3xl" />
          <motion.div
            initial={{ opacity: 0, scale: 0.94, x: -24 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
            className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/15 bg-white/5 p-3 shadow-2xl backdrop-blur-sm"
          >
            <div className="overflow-hidden rounded-2xl bg-secondary">
              <CmsImage
                src={product.image}
                alt={product.name}
                className="max-h-[68vh] w-full object-contain"
              />
            </div>
          </motion.div>
        </div>

        {/* Right — the write-up */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
          className="flex flex-col justify-center px-6 pb-16 pt-4 text-center lg:px-12 lg:py-16"
        >
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent">
            {product.category} · {product.size}
          </p>
          <h2 className="mt-3 font-display text-3xl font-extrabold uppercase leading-tight sm:text-4xl">
            {product.name}
          </h2>

          <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed text-white/75 sm:text-base">
            {product.description}
          </p>

          <h3 className="mt-10 text-sm font-bold uppercase tracking-[0.18em]">Product details</h3>
          <div className="mx-auto mt-5 grid w-full max-w-xl grid-cols-3 divide-x divide-white/20">
            {facts.map((f) => (
              <div key={f.label} className="px-3">
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-white">{f.label}</p>
                <p className="mt-1.5 text-xs text-white/70 sm:text-sm">{f.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <AppLink
              href="/contact"
              className="rounded-full bg-accent px-6 py-3 text-sm font-bold text-accent-foreground transition-transform hover:-translate-y-0.5"
            >
              Enquire about this product
            </AppLink>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/30 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10"
            >
              Back to products
            </button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

function NewsletterBlock() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <Section tone="deep" className="py-12 lg:py-16">
      <div className="grid items-center gap-8 lg:grid-cols-2">
        <SectionHeading
          invert
          eyebrow="Newsletter"
          title="Trade updates, new lines and factory news"
          description="One email a month for distributors, retail partners and anyone who cares how the products are made."
        />
        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            await submitWithMock(ENDPOINTS.newsletter, { email }, { ok: true });
            setBusy(false);
            setEmail("");
            toast.success("You're subscribed. Watch your inbox.");
          }}
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="h-12 flex-1 rounded-full border border-primary-foreground/25 bg-primary-foreground/10 px-6 text-sm text-primary-foreground placeholder:text-primary-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <button
            type="submit"
            disabled={busy}
            className="h-12 rounded-full bg-accent px-7 text-sm font-bold text-accent-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-60"
          >
            {busy ? "Subscribing…" : "Subscribe"}
          </button>
        </form>
      </div>
    </Section>
  );
}