import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import { MapPin, X } from "lucide-react";
import { HeroSlider } from "@/components/site/hero-slider";
import { AppLink } from "@/components/site/app-link";
import { BrandGlobe } from "@/components/brand/brand-globe";
import { CmsImage, EmptyBlock, Hl, LoadingBlock, Section, SectionHeading } from "@/components/site/primitives";
import { useBlogPosts, useBusinessUnits, useHeroSlides, useProducts } from "@/hooks/use-cms";
import { ENDPOINTS, formErrorMessage, submitForm } from "@/lib/api";
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
      { property: "og:description", content: "Five brands. One Nigerian manufacturing house. God Is Our Strength." },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,500;1,600&display=swap",
      },
    ],
  }),
  component: HomePage,
});

/* ---------- Type system: Times New Roman everywhere, one italic accent face ---------- */
const PAGE_CSS = `
.bw-page, .bw-page [class*="font-display"], .bw-page h1, .bw-page h2, .bw-page h3 { font-family: "Times New Roman", Times, serif; }
.bw-page .bw-accent { font-family: "Cormorant Garamond", "Times New Roman", serif; font-style: italic; font-weight: 600; }
.bw-ivory { background: #faf6ef; }
.bw-rule { height: 1px; background: linear-gradient(to right, transparent, rgba(10,34,80,.25), transparent); }
`;

const UNIT_ORDER = ["vivon", "bluefragrance", "blueworld-cosmetics", "bluecrystal", "blow-right"];
function orderUnits<T extends { slug: string }>(units: T[]): T[] {
  const rank = (s: string) => (UNIT_ORDER.indexOf(s) === -1 ? UNIT_ORDER.length : UNIT_ORDER.indexOf(s));
  return [...units].sort((a, b) => rank(a.slug) - rank(b.slug));
}

const TRUST = [
  { k: "2014", v: "Founded in Lagos" },
  { k: "500+", v: "People employed" },
  { k: "5", v: "Brands" },
  { k: "120+", v: "SKUs" },
  { k: "9", v: "Countries" },
  { k: "11", v: "QC checks per batch" },
];

const fadeUp = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.7, ease: "easeOut" as const },
};

function HomePage() {
  const slides = useHeroSlides();
  const units = useBusinessUnits();
  const products = useProducts();
  const posts = useBlogPosts();
  const countryShowcases = useCollection("countryShowcases");
  const [activeCountry, setActiveCountry] = useState<string | null>(null);
  const [openProduct, setOpenProduct] = useState<Product | null>(null);
  const [category, setCategory] = useState("All");

  const showcase = activeCountry
    ? countryShowcases.find((s) => s.name.toLowerCase() === activeCountry.toLowerCase()) ?? null
    : null;
  const orderedUnits = orderUnits(units.data ?? []);
  const latest = (posts.data ?? []).slice(0, 3);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set((products.data ?? []).map((p) => p.category)))],
    [products.data],
  );
  const shown = useMemo(() => {
    const all = products.data ?? [];
    const pool = category === "All" ? all.filter((p) => p.featured).concat(all.filter((p) => !p.featured)) : all.filter((p) => p.category === category);
    return pool.slice(0, 8);
  }, [products.data, category]);

  return (
    <div className="bw-page">
      <style>{PAGE_CSS}</style>
      <HeroFlag />
      {slides.isLoading ? (
        <div className="h-[70vh] animate-pulse bg-primary-deep" />
      ) : (
        <HeroSlider slides={slides.data ?? []} />
      )}

      {/* Trust strip: numbers in italic accent, labels quiet */}
      <div className="bg-primary-deep py-7">
        <div className="mx-auto grid max-w-7xl grid-cols-3 gap-y-5 px-5 sm:grid-cols-6 lg:px-8">
          {TRUST.map((s) => (
            <div key={s.k} className="text-center">
              <p className="bw-accent bw-orange text-3xl">{s.k}</p>
              <p className="mt-1 text-[0.62rem] uppercase tracking-[0.18em] text-primary-foreground/70">{s.v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Statement */}
      <section className="bw-ivory px-5 py-20 text-center lg:py-28">
        <motion.div {...fadeUp} className="mx-auto max-w-3xl">
          <p className="eyebrow">Our house</p>
          <h2 className="mt-5 text-3xl leading-tight text-primary-deep sm:text-5xl">
            Five brands. 2 Branches. <Hl>Made</Hl> in Lagos, <Hl>properly</Hl>.
          </h2>
          <div className="mt-8">
            <ScrollRevealText
              text="God Is Our Strength"
              className="text-sm font-semibold uppercase tracking-[0.3em] text-primary-deep/70"
            />
          </div>
        </motion.div>
      </section>

      {/* Brands */}
      <section className="bg-white px-5 py-16 lg:py-24">
        <SectionHeading
          align="center"
          eyebrow="Our business"
          title={<>Five brands, built for <Hl>different</Hl> shelves</>}
          description="Each unit runs its own formulation brief and packaging language, sharing one factory floor and one quality standard."
        />
        <div className="mx-auto mt-14 flex max-w-[1600px] flex-wrap justify-center gap-x-5 gap-y-12">
          {units.isLoading && <div className="w-full"><LoadingBlock label="Loading business units…" /></div>}
          {!units.isLoading && orderedUnits.length === 0 && <div className="w-full"><EmptyBlock label="No business units published yet." /></div>}
          {orderedUnits.map((unit, i) => (
            <motion.div
              key={unit.id}
              className="w-[calc(50%_-_0.625rem)] sm:w-[calc(33.333%_-_0.85rem)] lg:w-[300px]"
              {...fadeUp}
              transition={{ duration: 0.6, delay: i * 0.06 }}
            >
              <AppLink href={`/business/${unit.slug}`} className="group block">
                <div className="relative aspect-[3/4] overflow-hidden rounded-t-full rounded-b-2xl bg-secondary ring-1 ring-border">
                  <CmsImage src={unit.heroImage} alt={unit.name} className="h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-105" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/45 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                </div>
                <div className="mt-4 text-center">
                  <p className="bw-accent text-sm text-muted-foreground">Collection</p>
                  <h3 className="mt-1 text-lg font-bold text-primary-deep">{unit.name}</h3>
                  <p className="mt-1 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-accent">{unit.tagline}</p>
                  <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-500 group-hover:grid-rows-[1fr]">
                    <div className="overflow-hidden">
                      <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">{unit.summary}</p>
                    </div>
                  </div>
                </div>
              </AppLink>
            </motion.div>
          ))}
        </div>
      </section>

      {/* PRODUCTS: a real section, filterable, opens the same detail overlay */}
      <section id="products" className="bw-ivory px-5 py-16 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <motion.div {...fadeUp} className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="eyebrow">Products</p>
              <h2 className="mt-3 text-3xl text-primary-deep sm:text-4xl">
                What the lines are <Hl>shipping</Hl> now
              </h2>
            </div>
            <AppLink href="/products" className="border-b border-accent pb-1 text-xs font-bold uppercase tracking-[0.18em] text-primary-deep transition-colors hover:text-accent">
              View all products
            </AppLink>
          </motion.div>

          <div className="mt-8 flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-[0.12em] transition-colors ${
                  category === c ? "border-primary-deep bg-primary-deep text-white" : "border-primary-deep/20 text-primary-deep hover:border-accent hover:text-accent"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          {products.isLoading && <div className="mt-10"><LoadingBlock label="Loading products…" /></div>}
          {!products.isLoading && shown.length === 0 && <div className="mt-10"><EmptyBlock label="No products published yet." /></div>}

          <div className="mt-10 grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-4">
            {shown.map((p, i) => (
              <motion.button
                key={p.id}
                type="button"
                onClick={() => setOpenProduct(p)}
                className="group text-left"
                {...fadeUp}
                transition={{ duration: 0.5, delay: (i % 4) * 0.06 }}
              >
                <div className="aspect-square overflow-hidden bg-white ring-1 ring-primary-deep/10">
                  <CmsImage src={p.image} alt={p.name} className="h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-105" />
                </div>
                <p className="mt-4 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-accent">{p.category} · {p.size}</p>
                <h3 className="mt-1 text-lg font-bold text-primary-deep">{p.name}</h3>
                <span className="mt-2 inline-block bg-gradient-to-r from-accent to-accent bg-[length:0%_1px] bg-[position:0_100%] bg-no-repeat pb-0.5 text-xs text-primary-deep/70 transition-[background-size] duration-500 group-hover:bg-[length:100%_1px]">
                  View details
                </span>
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      {/* Reach: globe + country card */}
      <Section tone="muted" className="py-16 lg:py-24">
        <div className="grid items-stretch gap-6 lg:grid-cols-2">
          <motion.div {...fadeUp} className="flex flex-col rounded-3xl border border-border bg-card p-5 shadow-card lg:p-6">
            <p className="eyebrow">Where we ship</p>
            <h3 className="mt-2 text-2xl font-bold text-primary-deep">Made in Nigeria, carried around the world</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              From our organization at Obadore, Igando, Lagos, Blue World reaches households across four countries. Tap a marker, or a market below.
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
                    className={`rounded-full border px-4 py-1.5 text-xs font-bold transition-colors ${active ? "border-transparent bg-accent text-accent-foreground" : "border-border text-primary-deep hover:bg-primary-soft"}`}
                  >
                    {m.name}
                  </button>
                );
              })}
            </div>
          </motion.div>

          <motion.div {...fadeUp} className="relative rounded-3xl border border-border bg-card shadow-card">
            <div className="flex h-full flex-col p-5 lg:absolute lg:inset-0 lg:overflow-y-auto lg:p-6">
              <AnimatePresence mode="wait">
                {showcase ? (
                  <motion.div key={activeCountry} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.3 }} className="flex flex-1 flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="eyebrow">{showcase.place}</p>
                        <h3 className="mt-2 text-2xl font-bold text-primary-deep">{showcase.headline}</h3>
                      </div>
                      <button type="button" onClick={() => setActiveCountry(null)} className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-bold text-primary-deep hover:bg-primary-soft">
                        ← Overview
                      </button>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{showcase.blurb}</p>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{showcase.detail}</p>
                    <div className="mt-4 flex items-center gap-3 rounded-2xl bg-accent-soft p-4">
                      <span className="bw-accent bw-orange text-3xl">{showcase.statValue}</span>
                      <span className="text-xs font-semibold uppercase tracking-wide text-primary-deep/70">{showcase.statLabel}</span>
                    </div>
                    <div className="mt-3 flex flex-1 flex-col rounded-2xl border border-border px-4">
                      {showcase.points.map((pt) => (
                        <div key={pt} className="flex min-h-[2.25rem] flex-1 items-center gap-2 border-b border-border py-2 text-sm font-semibold text-primary-deep last:border-b-0">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                          {pt}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="overview" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.3 }} className="flex flex-1 flex-col">
                    <p className="eyebrow">Every marker, explained</p>
                    <h3 className="mt-2 text-2xl font-bold text-primary-deep">5 Countries, one organization</h3>
                    <div className="mt-4 flex flex-1 flex-col gap-2.5">
                      {REACH_MARKERS.map((m) => {
                        const s = countryShowcases.find((c) => c.name.toLowerCase() === m.name.toLowerCase());
                        return (
                          <button key={m.name} type="button" onClick={() => setActiveCountry(m.name)} className="flex min-h-[4rem] flex-1 items-center gap-3 rounded-xl bg-accent-soft/60 px-4 py-2.5 text-left transition-colors hover:bg-accent-soft">
                            <MapPin size={14} className="shrink-0 text-accent" />
                            <span className="min-w-0 flex-1">
                              <span className="block text-base font-bold text-primary-deep">{m.name}</span>
                              <span className="block text-xs text-muted-foreground">{m.note}</span>
                            </span>
                            {s && (
                              <span className="shrink-0 text-right">
                                <span className="bw-accent block text-xl leading-none text-accent">{s.statValue}</span>
                                <span className="mt-1 block text-[0.6rem] uppercase tracking-wide text-primary-deep/60">{s.statLabel}</span>
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </Section>

      {/* Quote */}
      <section className="bw-ivory px-5 py-24 text-center">
        <motion.blockquote {...fadeUp} className="mx-auto max-w-3xl">
          <p className="text-3xl leading-snug text-primary-deep sm:text-5xl">
            “Make it <Hl>properly</Hl>, or do not ship it.”
          </p>
          <footer className="mt-6 text-xs font-semibold uppercase tracking-[0.22em] text-accent">The rule since 2014</footer>
        </motion.blockquote>
      </section>

      {/* Blog */}
      <section className="bg-white px-5 py-16 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <SectionHeading eyebrow="From the blog" title={<>News, research and <Hl>factory</Hl> notes</>} />
            <AppLink href="/blog" className="border-b border-accent pb-1 text-xs font-bold uppercase tracking-[0.18em] text-primary-deep hover:text-accent">
              All posts
            </AppLink>
          </div>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {latest.map((post) => (
              <AppLink key={post.id} href={`/blog/${post.slug}`} className="group block">
                <div className="aspect-[16/10] overflow-hidden">
                  <CmsImage src={post.coverImage} alt={post.title} className="h-full w-full object-cover transition-transform duration-[900ms] group-hover:scale-105" />
                </div>
                <p className="eyebrow mt-4">{post.category}</p>
                <h3 className="mt-2 text-xl font-bold leading-snug text-primary-deep">{post.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{post.excerpt}</p>
              </AppLink>
            ))}
          </div>
        </div>
      </section>

      <NewsletterBlock />

      <AnimatePresence>
        {openProduct && <ProductDetail key={openProduct.id} product={openProduct} onClose={() => setOpenProduct(null)} />}
      </AnimatePresence>
    </div>
  );
}

function ProductDetail({ product, onClose }: { product: Product; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
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
      className="fixed inset-0 z-[70] overflow-y-auto bg-[#0a2250] text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <button type="button" onClick={onClose} aria-label="Close product" className="fixed right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-white/10 backdrop-blur hover:bg-white/20 sm:right-6 sm:top-6">
        <X size={18} />
      </button>
      <div className="mx-auto grid min-h-full max-w-7xl lg:grid-cols-2">
        <div className="flex items-center justify-center px-6 pb-6 pt-20 lg:px-12 lg:py-16">
          <div className="w-full max-w-lg overflow-hidden bg-secondary">
            <CmsImage src={product.image} alt={product.name} className="max-h-[68vh] w-full object-contain" />
          </div>
        </div>
        <div className="flex flex-col justify-center px-6 pb-16 pt-4 text-center lg:px-12 lg:py-16">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent">{product.category} · {product.size}</p>
          <h2 className="mt-3 text-4xl font-bold leading-tight">{product.name}</h2>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/75">{product.description}</p>
          <div className="mx-auto mt-10 grid w-full max-w-xl grid-cols-3 divide-x divide-white/20">
            {facts.map((f) => (
              <div key={f.label} className="px-3">
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em]">{f.label}</p>
                <p className="mt-1.5 text-sm text-white/70">{f.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <AppLink href="/contact" className="bg-accent px-7 py-3.5 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-accent-foreground transition-colors hover:bg-white hover:text-primary-deep">Enquire about this product</AppLink>
            <button type="button" onClick={onClose} className="border border-white/40 px-7 py-3.5 text-[0.72rem] font-bold uppercase tracking-[0.16em] hover:bg-white/10">Back to products</button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function NewsletterBlock() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Section tone="deep" className="py-16 lg:py-20">
      <div className="grid items-center gap-8 lg:grid-cols-2">
        <SectionHeading invert eyebrow="Newsletter" title={<>Trade updates, new lines and <Hl>factory news</Hl></>} description="One email a month for distributors, retail partners and anyone who cares how the products are made." />
        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            const website = String(new FormData(e.currentTarget).get("website") ?? "");
            setBusy(true);
            try {
              await submitForm(ENDPOINTS.newsletter, { email: email.trim(), website });
              setEmail("");
              toast.success("You're subscribed. Watch your inbox.");
            } catch (err) {
              toast.error("Couldn't subscribe", { description: formErrorMessage(err) });
            } finally {
              setBusy(false);
            }
          }}
        >
          {/* Honeypot: invisible to people, tempting to bots. */}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" />
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className="h-12 flex-1 border border-primary-foreground/25 bg-primary-foreground/10 px-6 text-sm text-primary-foreground placeholder:text-primary-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent" />
          <button type="submit" disabled={busy} className="h-12 bg-accent px-8 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-accent-foreground disabled:opacity-60">
            {busy ? "Subscribing…" : "Subscribe"}
          </button>
        </form>
      </div>
    </Section>
  );
}