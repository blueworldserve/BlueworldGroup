import { useEffect } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { AppLink } from "@/components/site/app-link";
import { CmsImage } from "@/components/site/primitives";
import type { Product } from "@/lib/types";

/** Full-screen product detail view: image on the left, description on the right. */
export function ProductDetail({ product, onClose }: { product: Product; onClose: () => void }) {
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
      <button
        type="button"
        onClick={onClose}
        aria-label="Close product"
        className="fixed right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-white/10 backdrop-blur hover:bg-white/20 sm:right-6 sm:top-6"
      >
        <X size={18} />
      </button>
      <div className="mx-auto grid min-h-full max-w-7xl lg:grid-cols-2">
        <div className="flex items-center justify-center px-6 pb-6 pt-20 lg:px-12 lg:py-16">
          <div className="w-full max-w-lg overflow-hidden bg-secondary">
            <CmsImage src={product.image} alt={product.name} className="max-h-[68vh] w-full object-contain" />
          </div>
        </div>
        <div className="flex flex-col justify-center px-6 pb-16 pt-4 text-center lg:px-12 lg:py-16">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent">
            {product.category} · {product.size}
          </p>
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
            <AppLink
              href="/contact"
              className="bg-accent px-7 py-3.5 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-accent-foreground transition-colors hover:bg-white hover:text-primary-deep"
            >
              Enquire about this product
            </AppLink>
            <button
              type="button"
              onClick={onClose}
              className="border border-white/40 px-7 py-3.5 text-[0.72rem] font-bold uppercase tracking-[0.16em] hover:bg-white/10"
            >
              Back to products
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}