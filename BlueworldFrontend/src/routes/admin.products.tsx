import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { ImageOff, Plus, Star, Trash2 } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { WriteGate } from "@/components/admin/write-gate";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, EDITOR_DIALOG_CLASS } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteItem, newId, upsertItem, useCollection } from "@/lib/cms-store";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/products")({
  head: () => ({
    meta: [
      { title: "Products — Blue World CMS" },
      { name: "description", content: "Manage the product catalogue across all brands." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Products — Blue World CMS" },
      { property: "og:description", content: "Manage the Blue World product catalogue." },
    ],
  }),
  component: ProductsAdmin,
});

const PRODUCT_CATEGORIES = [
  "Body Lotions",
  "Body Creams",
  "Face Care",
  "Body Wash & Shower Gel",
  "Bathing Soaps",
  "Hair Relaxers",
  "Shampoos & Conditioners",
  "Hair Styling Products",
  "Perfumes",
  "Body Sprays & Mists",
  "Roll-ons & Deodorants",
  "Petroleum Jelly",
  "Glycerin & Oils",
  "Antiseptics & Disinfectants",
  "Hand & Personal Hygiene",
  "Baby Care",
  "Children's Care",
];

const UNITS = [
  { value: "vivon", label: "Vivon" },
  { value: "bluecrystal", label: "Blue Crystal" },
  { value: "blow-right", label: "Blow Right" },
  { value: "bluefragrance", label: "Blue Fragrance" },
  { value: "blueworld-cosmetics", label: "Blue World Cosmetics" },
] as const;

const VIVON_RANGES = ["face", "body", "children"] as const;

const unitLabel = (value: string) => UNITS.find((u) => u.value === value)?.label ?? value;

/** Product.image may be a real URL or a built-in asset key (like "hero.products"). */
const isImageUrl = (value: string) => /^(https?:|\/|data:)/.test(value);

const inputClass = "mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
const labelClass = "text-xs font-bold uppercase tracking-[0.14em] text-accent";

function ProductsAdmin() {
  const products = useCollection("products");
  const [unit, setUnit] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{ product: Product; isNew: boolean } | null>(null);
  const [toDelete, setToDelete] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Sidebar: every brand, with how many products it has and how many are featured.
  const brands = useMemo(() => {
    const known: string[] = UNITS.map((u) => u.value);
    const extra = products.map((p) => p.unit as string).filter((u) => !known.includes(u));
    return [...known, ...Array.from(new Set(extra))].map((value) => {
      const mine = products.filter((p) => p.unit === value);
      return { slug: value, title: unitLabel(value), count: mine.length, featured: mine.filter((p) => p.featured).length };
    });
  }, [products]);

  const inBrand = useMemo(() => products.filter((p) => unit === "all" || p.unit === unit), [products, unit]);

  // Category pills only show categories that exist inside the selected brand.
  const categories = useMemo(() => Array.from(new Set(inBrand.map((p) => p.category).filter(Boolean))).sort(), [inBrand]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inBrand.filter(
      (p) =>
        (category === "all" || p.category === category) &&
        (!featuredOnly || p.featured) &&
        (!q || [p.name, p.category, p.size ?? "", p.description ?? ""].some((v) => v.toLowerCase().includes(q))),
    );
  }, [inBrand, category, featuredOnly, query]);

  function pickBrand(slug: string) {
    setUnit(slug);
    setCategory("all");
  }

  function startNew() {
    const product = {
      id: newId("p"),
      name: "",
      unit: unit === "all" ? "vivon" : unit,
      category: "",
      description: "",
      size: "",
      image: "hero.products",
      featured: false,
    } as Product;
    setEditing({ product, isNew: true });
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await Promise.resolve(deleteItem("products", toDelete.id));
      if (editing?.product.id === toDelete.id) setEditing(null);
      toast.success("Product deleted");
      setToDelete(null);
    } catch {
      toast.error("Could not delete this product.");
    } finally {
      setDeleting(false);
    }
  }

  const sidebar = [{ slug: "all", title: "All products", count: products.length, featured: products.filter((p) => p.featured).length }, ...brands];
  const selectedTitle = sidebar.find((s) => s.slug === unit)?.title ?? "All products";

  return (
    <AdminShell title="Products" description="Catalogue entries shown on each brand page. Filter by brand, open one to edit it.">
      <WriteGate resource="products">
        <div className="grid gap-6 lg:grid-cols-[270px_minmax(0,1fr)]">
          {/* Brands */}
          <aside className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {sidebar.map((s) => (
              <button
                key={s.slug}
                type="button"
                onClick={() => pickBrand(s.slug)}
                className={cn(
                  "flex shrink-0 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors lg:shrink",
                  unit === s.slug ? "border-primary-deep bg-primary-deep text-primary-foreground" : "border-border bg-card hover:bg-primary-soft",
                )}
              >
                <span className="min-w-0 truncate text-sm font-bold">{s.title}</span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {s.featured > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[0.65rem] font-bold text-accent-foreground">
                      <Star className="h-3 w-3" /> {s.featured}
                    </span>
                  )}
                  <span className={cn("text-xs font-bold", unit === s.slug ? "text-primary-foreground/80" : "text-muted-foreground")}>{s.count}</span>
                </span>
              </button>
            ))}
          </aside>

          {/* Product grid */}
          <section className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold text-primary-deep">
                {selectedTitle} <span className="font-normal text-muted-foreground">· {shown.length}</span>
              </h2>
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                <input
                  type="search"
                  enterKeyHint="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name, category, size…"
                  className="min-w-0 flex-1 rounded-full border border-border bg-background px-4 py-1.5 text-sm sm:w-56 sm:flex-none"
                />
                <Button onClick={startNew}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add product
                </Button>
              </div>
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-2">
              {["all", ...categories].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-bold",
                    category === c ? "border-primary-deep bg-primary-deep text-primary-foreground" : "border-border hover:bg-primary-soft",
                  )}
                >
                  {c === "all" ? "All categories" : c}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setFeaturedOnly((v) => !v)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold",
                  featuredOnly ? "border-accent bg-accent text-accent-foreground" : "border-border hover:bg-primary-soft",
                )}
              >
                <Star className="h-3 w-3" /> Featured only
              </button>
            </div>

            {shown.length === 0 && (
              <p className="rounded-2xl border border-border bg-card p-6 text-sm text-foreground/60">
                {products.length === 0 ? "No products yet. Add the first one." : "No products match."}
              </p>
            )}

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {shown.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  showBrand={unit === "all"}
                  onOpen={() => setEditing({ product: p, isNew: false })}
                  onDelete={() => setToDelete(p)}
                />
              ))}
            </div>
          </section>
        </div>

        {editing && (
          <ProductDialog
            key={editing.product.id}
            product={editing.product}
            isNew={editing.isNew}
            onClose={() => setEditing(null)}
            onDelete={() => setToDelete(editing.product)}
          />
        )}

        <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && !deleting && setToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this product?</AlertDialogTitle>
              <AlertDialogDescription>
                {toDelete?.name ? `"${toDelete.name}"` : "This product"} will be removed from the catalogue and from its brand page. This can't be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button onClick={() => setToDelete(null)} disabled={deleting}>
                Keep it
              </Button>
              <Button variant="destructive" onClick={() => void confirmDelete()} disabled={deleting}>
                {deleting ? "Deleting…" : "Delete product"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </WriteGate>
    </AdminShell>
  );
}

function ProductImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (src && isImageUrl(src) && !broken) {
    return <img src={src} alt={alt} loading="lazy" onError={() => setBroken(true)} className={cn("h-full w-full object-cover", className)} />;
  }
  return (
    <div className="grid h-full w-full place-items-center p-2 text-center text-muted-foreground">
      <div>
        <ImageOff className="mx-auto h-6 w-6" />
        {src && !isImageUrl(src) && <p className="mt-1 truncate text-[0.65rem]">{src}</p>}
      </div>
    </div>
  );
}

function ProductCard({
  product,
  showBrand,
  onOpen,
  onDelete,
}: {
  product: Product;
  showBrand: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen()}
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-colors hover:border-primary/40"
    >
      <div className="relative aspect-square w-full bg-secondary">
        <ProductImage src={product.image ?? ""} alt={product.name} />
        {product.featured && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[0.65rem] font-bold text-accent-foreground">
            <Star className="h-3 w-3" /> Featured
          </span>
        )}
        <button
          type="button"
          aria-label={`Delete ${product.name}`}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full border border-border bg-card/90 text-muted-foreground opacity-100 transition-opacity hover:border-destructive/50 hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="min-w-0 space-y-1.5 p-3">
        <p className="truncate font-display text-sm font-bold text-primary-deep">{product.name || "Untitled product"}</p>
        <p className="truncate text-xs text-muted-foreground">
          {[product.category, product.size].filter(Boolean).join(" · ") || "No category yet"}
        </p>
        <div className="flex flex-wrap gap-1">
          {showBrand && (
            <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[0.65rem] font-bold text-primary-deep">{unitLabel(product.unit)}</span>
          )}
          {product.unit === "vivon" && product.subLine && (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[0.65rem] font-bold capitalize text-muted-foreground">{product.subLine}</span>
          )}
        </div>
      </div>
    </div>
  );
}

/** Add / edit popup: image on the left, details on the right. */
function ProductDialog({
  product,
  isNew,
  onClose,
  onDelete,
}: {
  product: Product;
  isNew: boolean;
  onClose: () => void;
  onDelete: () => void;
}) {
  const media = useCollection("mediaLibrary");
  const [name, setName] = useState(product.name ?? "");
  const [unit, setUnit] = useState<string>(product.unit);
  const [subLine, setSubLine] = useState<string>((product.subLine as string | undefined) ?? "");
  const [category, setCategory] = useState(product.category ?? "");
  const [description, setDescription] = useState(product.description ?? "");
  const [size, setSize] = useState(product.size ?? "");
  const [image, setImage] = useState(product.image ?? "");
  const [featured, setFeatured] = useState(!!product.featured);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);

  const categoryOptions = category && !PRODUCT_CATEGORIES.includes(category) ? [category, ...PRODUCT_CATEGORIES] : PRODUCT_CATEGORIES;
  const unitOptions = UNITS.some((u) => u.value === unit) ? UNITS : [...UNITS, { value: unit, label: unit }];

  async function save() {
    if (!name.trim()) {
      toast.error("Give the product a name first.");
      return;
    }
    setSaving(true);
    try {
      const { subLine: _drop, ...rest } = product as Product & { subLine?: string };
      void _drop;
      const next = {
        ...rest,
        name: name.trim(),
        unit,
        category,
        description,
        size,
        image,
        featured,
        // The Vivon range only applies to Vivon products.
        ...(unit === "vivon" && subLine ? { subLine } : {}),
      } as Product;
      await Promise.resolve(upsertItem("products", next));
      toast.success(isNew ? "Product added" : "Saved");
      onClose();
    } catch {
      toast.error("Could not save this product.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className={cn(EDITOR_DIALOG_CLASS, "sm:max-w-5xl")}>
        <DialogHeader className="border-b border-border p-5 text-left">
          <DialogTitle className="pr-8 font-display text-xl text-primary-deep">{isNew ? "Add product" : name || "Untitled product"}</DialogTitle>
          <DialogDescription>{isNew ? "Fill in the details and pick an image." : "Edit this product's details and image."}</DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 content-start overflow-y-auto lg:grid-cols-[2fr_3fr] lg:overflow-hidden">
          {/* Image */}
          <div className="min-h-0 space-y-4 overflow-y-auto bg-secondary p-5">
            <div className="mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-xl border border-border bg-card">
              <ProductImage src={image} alt={name} className="object-contain" />
            </div>

            <label className="block text-sm">
              <span className={labelClass}>Image link or key</span>
              <input value={image} onChange={(e) => setImage(e.target.value)} className={inputClass} />
            </label>

            <Button variant="outline" onClick={() => setPicking((v) => !v)}>
              {picking ? "Hide Media Library" : "Choose from Media Library"}
            </Button>

            {picking && (
              <div className="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto rounded-xl border border-border bg-card p-2">
                {media.length === 0 && <p className="col-span-3 p-3 text-xs text-muted-foreground">No images in the Media Library yet.</p>}
                {media.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    title={m.filename}
                    onClick={() => setImage(m.url)}
                    className={cn(
                      "aspect-square overflow-hidden rounded-lg border-2 bg-secondary",
                      image === m.url ? "border-accent" : "border-transparent hover:border-primary/40",
                    )}
                  >
                    <img src={m.url} alt={m.filename} loading="lazy" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="min-h-0 space-y-5 overflow-y-auto border-t border-border p-5 lg:border-l lg:border-t-0">
            <label className="block text-sm">
              <span className={labelClass}>Product name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className={labelClass}>Business unit</span>
                <select value={unit} onChange={(e) => setUnit(e.target.value)} className={inputClass}>
                  {unitOptions.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </label>

              {unit === "vivon" && (
                <label className="block text-sm">
                  <span className={labelClass}>Vivon range</span>
                  <select value={subLine} onChange={(e) => setSubLine(e.target.value)} className={inputClass}>
                    <option value="">Not set</option>
                    {VIVON_RANGES.map((r) => (
                      <option key={r} value={r}>
                        {r.charAt(0).toUpperCase() + r.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className={labelClass}>Category</span>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
                  <option value="">Choose a category</option>
                  {categoryOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className={labelClass}>Pack size</span>
                <input value={size} onChange={(e) => setSize(e.target.value)} className={inputClass} />
              </label>
            </div>

            <label className="block text-sm">
              <span className={labelClass}>Description</span>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className={inputClass} />
            </label>

            <button
              type="button"
              onClick={() => setFeatured((v) => !v)}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold",
                featured ? "border-accent bg-accent text-accent-foreground" : "border-border hover:bg-primary-soft",
              )}
            >
              <Star className="h-4 w-4" />
              {featured ? "Featured on homepage" : "Not featured on homepage"}
            </button>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          {isNew ? (
            <span />
          ) : (
            <button type="button" onClick={onDelete} className="inline-flex min-h-10 items-center justify-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" /> Delete product
            </button>
          )}
          <div className="flex gap-2 [&>button]:flex-1 sm:[&>button]:flex-none">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : isNew ? "Add product" : "Save changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}