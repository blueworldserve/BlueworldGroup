import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Search, X } from "lucide-react";
import { HeroFlag } from "@/components/site/hero-context";
import { CmsImage, EmptyBlock, LoadingBlock } from "@/components/site/primitives";
import { ProductDetail } from "@/components/site/product-detail";
import { useBusinessUnits, useProducts } from "@/hooks/use-cms";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/products")({
  head: () => ({
    meta: [
      { title: "Products — Blue World Cosmetics" },
      {
        name: "description",
        content:
          "Browse the full range of skincare, hygiene, haircare and fragrance products from Vivon, BlueCrystal, Blow Right, BlueFragrance and BlueWorld Cosmetics.",
      },
      { property: "og:title", content: "Products — Blue World Cosmetics" },
      {
        property: "og:description",
        content: "The full Blue World Cosmetics product range, made in Lagos, Nigeria.",
      },
    ],
  }),
  component: ProductsPage,
});

function chipClass(active: boolean) {
  return cn(
    "rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-[0.12em] transition-colors",
    active
      ? "border-primary-deep bg-primary-deep text-white"
      : "border-primary-deep/20 text-primary-deep hover:border-accent hover:text-accent",
  );
}

function ProductsPage() {
  const products = useProducts();
  const units = useBusinessUnits();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [unit, setUnit] = useState("all");
  const [openProduct, setOpenProduct] = useState<Product | null>(null);

  const all = products.data;

  const categories = useMemo(
    () => ["All", ...Array.from(new Set((all ?? []).map((p) => p.category).filter(Boolean)))],
    [all],
  );

  // Only offer brand filters for brands that actually have products.
  const unitOptions = useMemo(
    () =>
      [...(units.data ?? [])]
        .sort((a, b) => a.order - b.order)
        .filter((u) => (all ?? []).some((p) => p.unit === u.slug)),
    [units.data, all],
  );
  const unitName = (slug: string) => units.data?.find((u) => u.slug === slug)?.name ?? "";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (all ?? []).filter((p) => {
      if (category !== "All" && p.category !== category) return false;
      if (unit !== "all" && p.unit !== unit) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      );
    });
    // Featured products first; everything else keeps its CMS order.
    return list.filter((p) => p.featured).concat(list.filter((p) => !p.featured));
  }, [all, category, unit, query]);

  const hasFilters = query.trim() !== "" || category !== "All" || unit !== "all";
  const clearFilters = () => {
    setQuery("");
    setCategory("All");
    setUnit("all");
  };

  return (
    <>
            {/* Same look as PageHero, but shorter so the products sit closer to the top. */}
      <section className="relative flex min-h-[46svh] items-center overflow-hidden bg-primary-deep md:min-h-[52vh]">
        <HeroFlag />
        <div className="absolute inset-0">
          <CmsImage src="hero.products" alt="" className="h-full w-full object-cover" eager />
          <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/30 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
        </div>
        <div className="relative mx-auto w-full max-w-7xl px-5 pb-12 pt-32 lg:px-8 lg:pb-16 lg:pt-36">
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl"
          >
            <p className="eyebrow">Products</p>
            <h1 className="mt-4 text-4xl font-extrabold leading-[1.05] text-primary-foreground lg:text-6xl">
              The full Blue World range
            </h1>
            <span className="mt-6 block h-0.5 w-16 bg-accent" />
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-primary-foreground/80">
              Skincare, hygiene, haircare and fragrance, formulated, filled and shipped from Lagos.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="bg-[#faf6ef] px-5 py-14 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-7xl">
          {/* Search */}
          <div className="relative max-w-md">
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-primary-deep/50" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products…"
              aria-label="Search products"
              className="h-12 w-full border border-primary-deep/20 bg-white pl-11 pr-4 text-sm text-primary-deep placeholder:text-primary-deep/40 focus:border-accent focus:outline-none"
            />
          </div>

          {/* Brand filter */}
          {unitOptions.length > 1 && (
            <div className="mt-6">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-primary-deep/60">Brand</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => setUnit("all")} className={chipClass(unit === "all")}>
                  All brands
                </button>
                {unitOptions.map((u) => (
                  <button key={u.slug} type="button" onClick={() => setUnit(u.slug)} className={chipClass(unit === u.slug)}>
                    {u.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Category filter */}
          {categories.length > 2 && (
            <div className="mt-6">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-primary-deep/60">Category</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {categories.map((c) => (
                  <button key={c} type="button" onClick={() => setCategory(c)} className={chipClass(category === c)}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Result count + clear */}
          {!products.isLoading && (all ?? []).length > 0 && (
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-primary-deep/10 pt-6">
              <p className="text-sm text-primary-deep/70">
                Showing {filtered.length} of {(all ?? []).length} products
              </p>
              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-primary-deep hover:text-accent"
                >
                  <X size={14} /> Clear filters
                </button>
              )}
            </div>
          )}

          {products.isLoading && (
            <div className="mt-10">
              <LoadingBlock label="Loading products…" />
            </div>
          )}

          {!products.isLoading && (all ?? []).length === 0 && (
            <div className="mt-10">
              <EmptyBlock label="No products published yet." />
            </div>
          )}

          {!products.isLoading && (all ?? []).length > 0 && filtered.length === 0 && (
            <div className="mt-10">
              <EmptyBlock label="No products match your search." />
            </div>
          )}

          {/* Grid */}
          <div className="mt-10 grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
            {filtered.map((p, i) => (
              <motion.button
                key={p.id}
                type="button"
                onClick={() => setOpenProduct(p)}
                className="group text-left"
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: (i % 4) * 0.06 }}
              >
                <div className="aspect-square overflow-hidden bg-white ring-1 ring-primary-deep/10">
                  <CmsImage
                    src={p.image}
                    alt={p.name}
                    className="h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-105"
                  />
                </div>
                {unitName(p.unit) && (
                  <p className="mt-4 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-primary-deep/50">
                    {unitName(p.unit)}
                  </p>
                )}
                <p className={cn("text-[0.6rem] font-bold uppercase tracking-[0.2em] text-accent", unitName(p.unit) ? "mt-1" : "mt-4")}>
                  {p.category} · {p.size}
                </p>
                <h3 className="mt-1 text-lg font-bold text-primary-deep">{p.name}</h3>
                <span className="mt-2 inline-block bg-gradient-to-r from-accent to-accent bg-[length:0%_1px] bg-[position:0_100%] bg-no-repeat pb-0.5 text-xs text-primary-deep/70 transition-[background-size] duration-500 group-hover:bg-[length:100%_1px]">
                  View details
                </span>
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      <AnimatePresence>
        {openProduct && (
          <ProductDetail key={openProduct.id} product={openProduct} onClose={() => setOpenProduct(null)} />
        )}
      </AnimatePresence>
    </>
  );
}