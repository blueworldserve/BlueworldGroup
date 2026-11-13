import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, X } from "lucide-react";
import { CmsImage, EmptyBlock } from "@/components/site/primitives";
import { ProductDetail } from "@/components/site/product-detail";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 12;

function chipClass(active: boolean) {
  return cn(
    "rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-[0.12em] transition-colors",
    active
      ? "border-primary-deep bg-primary-deep text-white"
      : "border-primary-deep/20 text-primary-deep hover:border-accent hover:text-accent",
  );
}

/** Same product grid as /products (4 per row on desktop), with search and category filters. */
export function ProductBrowser({ products, label }: { products: Product[]; label: string }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [openProduct, setOpenProduct] = useState<Product | null>(null);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(products.map((p) => p.category).filter(Boolean)))],
    [products],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = products.filter((p) => {
      if (category !== "All" && p.category !== category) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      );
    });
    return list.filter((p) => p.featured).concat(list.filter((p) => !p.featured));
  }, [products, category, query]);

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [query, category]);

  const hasFilters = query.trim() !== "" || category !== "All";

  return (
    <>
      <div className="relative max-w-md">
        <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-primary-deep/50" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${label} products…`}
          aria-label={`Search ${label} products`}
          className="h-12 w-full border border-primary-deep/20 bg-white pl-11 pr-4 text-sm text-primary-deep placeholder:text-primary-deep/40 focus:border-accent focus:outline-none"
        />
      </div>

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

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-primary-deep/10 pt-6">
        <p className="text-sm text-primary-deep/70">
          Showing {Math.min(visible, filtered.length)} of {filtered.length} products
        </p>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setCategory("All");
            }}
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-primary-deep hover:text-accent"
          >
            <X size={14} /> Clear filters
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="mt-10">
          <EmptyBlock label="No products match your search." />
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
          {filtered.slice(0, visible).map((p, i) => (
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
              <div className="aspect-square overflow-hidden rounded-2xl bg-white shadow-lg shadow-primary-deep/10 ring-1 ring-primary-deep/10 saturate-[1.12] contrast-[1.05] transition duration-500 group-hover:-translate-y-1 group-hover:shadow-xl">
                <CmsImage
                  src={p.image}
                  alt={p.name}
                  className="h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-105"
                />
              </div>
              <p className="mt-4 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-accent">
                {p.category} · {p.size}
              </p>
              <h3 className="mt-1 text-lg font-bold text-primary-deep">{p.name}</h3>
              <span className="mt-2 inline-block bg-gradient-to-r from-accent to-accent bg-[length:0%_1px] bg-[position:0_100%] bg-no-repeat pb-0.5 text-xs text-primary-deep/70 transition-[background-size] duration-500 group-hover:bg-[length:100%_1px]">
                View details
              </span>
            </motion.button>
          ))}
        </div>
      )}

      {visible < filtered.length && (
        <div className="mt-12 text-center">
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="rounded-full border border-primary-deep px-8 py-3 text-xs font-bold uppercase tracking-[0.16em] text-primary-deep transition-colors hover:bg-primary-deep hover:text-white"
          >
            Load more ({filtered.length - visible} left)
          </button>
        </div>
      )}

      <AnimatePresence>
        {openProduct && (
          <ProductDetail key={openProduct.id} product={openProduct} onClose={() => setOpenProduct(null)} />
        )}
      </AnimatePresence>
    </>
  );
}
