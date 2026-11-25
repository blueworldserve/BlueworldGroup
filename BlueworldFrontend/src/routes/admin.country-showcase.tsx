import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, ImageOff, Plus, Trash2, Video } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { WriteGate } from "@/components/admin/write-gate";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { findCountry, searchCountries } from "@/data/countries";
import { deleteItem, newId, upsertItem, useCollection } from "@/lib/cms-store";
import type { CountryShowcase } from "@/lib/types";
import { resolveTint, TINT_COLOR_NAMES } from "@/lib/tint";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/country-showcase")({
  head: () => ({
    meta: [
      { title: "Country Showcase | Blueworld CMS" },
      { name: "description", content: "The photo and write-up shown when a visitor taps a country marker on the homepage globe." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CountryShowcaseAdmin,
});

type StatusFilter = "all" | "complete" | "attention" | "video";

const inputClass = "mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
const labelClass = "text-xs font-bold uppercase tracking-[0.14em] text-accent";

/** Real image links preview; anything else (like a built-in asset key) shows a placeholder. */
const isImageUrl = (value: string) => /^(https?:|\/|data:)/.test(value);

const isComplete = (c: CountryShowcase) => !!(c.image && c.headline && c.blurb);

/** One plain colour for a tint. resolveTint may return a gradient; we keep only its first colour. */
function solidTint(tint: unknown): string {
  const css = String(resolveTint(tint as CountryShowcase["tint"]) ?? "");
  if (!css.includes("gradient")) return css || String(tint);
  const match = css.match(/#[0-9a-f]{3,8}\b|(?:rgb|hsl|oklch|oklab|lab|lch)a?\([^)]*\)/i);
  return match ? match[0] : String(tint);
}

function CountryShowcaseAdmin() {
  const collection = useCollection("countryShowcases");
  const items = useMemo(() => [...collection].sort((a, b) => a.order - b.order), [collection]);

  const [status, setStatus] = useState<StatusFilter>("all");
  const [tint, setTint] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{ item: CountryShowcase; isNew: boolean } | null>(null);
  const [toDelete, setToDelete] = useState<CountryShowcase | null>(null);
  const [deleting, setDeleting] = useState(false);

  const sidebar: { slug: StatusFilter; title: string; hint: string; count: number }[] = [
    { slug: "all", title: "All countries", hint: "", count: items.length },
    { slug: "complete", title: "Ready to show", hint: "Has photo, headline and first paragraph", count: items.filter(isComplete).length },
    { slug: "attention", title: "Needs attention", hint: "Missing photo, headline or first paragraph", count: items.filter((c) => !isComplete(c)).length },
    { slug: "video", title: "Has a video", hint: "", count: items.filter((c) => !!c.video).length },
  ];

  const inStatus = useMemo(
    () =>
      items.filter((c) => {
        if (status === "complete") return isComplete(c);
        if (status === "attention") return !isComplete(c);
        if (status === "video") return !!c.video;
        return true;
      }),
    [items, status],
  );

  const tints = useMemo(() => Array.from(new Set(inStatus.map((c) => c.tint as string).filter(Boolean))), [inStatus]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inStatus.filter(
      (c) =>
        (tint === "all" || c.tint === tint) &&
        (!q || [c.name, c.place, c.headline, c.statValue, c.statLabel].some((v) => (v ?? "").toLowerCase().includes(q))),
    );
  }, [inStatus, tint, query]);

  // Moving a card only makes sense when the grid shows the full list in its real order.
  const canReorder = status === "all" && tint === "all" && !query.trim();

  function pickStatus(s: StatusFilter) {
    setStatus(s);
    setTint("all");
  }

  function startNew() {
    setEditing({
      isNew: true,
      item: {
        id: newId("cs"),
        name: "",
        place: "",
        headline: "",
        blurb: "",
        detail: "",
        statValue: "",
        statLabel: "",
        points: [],
        image: "",
        video: null,
        tint: "green",
        order: items.length,
      } as CountryShowcase,
    });
  }

  async function move(id: string, dir: -1 | 1) {
    const from = items.findIndex((c) => c.id === id);
    const to = from + dir;
    if (from < 0 || to < 0 || to >= items.length) return;
    const next = [...items];
    [next[from], next[to]] = [next[to]!, next[from]!];
    try {
      // Renumber so the order stays clean even if the old numbers had gaps or ties.
      await Promise.all(next.map((c, i) => (c.order === i ? null : Promise.resolve(upsertItem("countryShowcases", { ...c, order: i })))));
    } catch {
      toast.error("Could not change the order.");
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await Promise.resolve(deleteItem("countryShowcases", toDelete.id));
      if (editing?.item.id === toDelete.id) setEditing(null);
      toast.success("Country removed");
      setToDelete(null);
    } catch {
      toast.error("Could not delete this country.");
    } finally {
      setDeleting(false);
    }
  }

  const selectedTitle = sidebar.find((s) => s.slug === status)?.title ?? "All countries";

  return (
    <AdminShell
      title="Country Showcase"
      description="What appears when someone taps a market on the homepage globe, one entry per country marker."
    >
      <WriteGate resource="country-showcases">
        <div className="grid gap-6 lg:grid-cols-[270px_minmax(0,1fr)]">
          {/* Status groups */}
          <aside className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {sidebar.map((s) => (
              <button
                key={s.slug}
                type="button"
                onClick={() => pickStatus(s.slug)}
                className={cn(
                  "flex shrink-0 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors lg:shrink",
                  status === s.slug ? "border-primary-deep bg-primary-deep text-primary-foreground" : "border-border bg-card hover:bg-primary-soft",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">{s.title}</span>
                  {s.hint && (
                    <span className={cn("hidden truncate text-xs lg:block", status === s.slug ? "text-primary-foreground/70" : "text-muted-foreground")}>
                      {s.hint}
                    </span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {s.slug === "attention" && s.count > 0 && (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-[0.65rem] font-bold text-accent-foreground">{s.count}</span>
                  )}
                  {s.slug !== "attention" && (
                    <span className={cn("text-xs font-bold", status === s.slug ? "text-primary-foreground/80" : "text-muted-foreground")}>{s.count}</span>
                  )}
                </span>
              </button>
            ))}
          </aside>

          {/* Cards */}
          <section className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold text-primary-deep">
                {selectedTitle} <span className="font-normal text-muted-foreground">· {shown.length}</span>
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search country, place, headline…"
                  className="w-60 rounded-full border border-border bg-background px-4 py-1.5 text-sm"
                />
                <Button onClick={startNew}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add country
                </Button>
              </div>
            </div>

            {tints.length > 1 && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {["all", ...tints].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTint(t)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold capitalize",
                      tint === t ? "border-primary-deep bg-primary-deep text-primary-foreground" : "border-border hover:bg-primary-soft",
                    )}
                  >
                    {t !== "all" && <span aria-hidden="true" className="h-3 w-3 rounded-full border border-border" style={{ backgroundColor: solidTint(t) }} />}
                    {t === "all" ? "All colours" : t}
                  </button>
                ))}
              </div>
            )}

            {canReorder && items.length > 1 && (
              <p className="mb-3 text-xs text-muted-foreground">Use the arrows on a card to change the order countries appear in.</p>
            )}

            {shown.length === 0 && (
              <p className="rounded-2xl border border-border bg-card p-6 text-sm text-foreground/60">
                {items.length === 0 ? "No countries yet. Add the first one." : "No countries match."}
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((c) => {
                const index = items.findIndex((x) => x.id === c.id);
                return (
                  <CountryCard
                    key={c.id}
                    item={c}
                    position={index + 1}
                    canReorder={canReorder}
                    isFirst={index === 0}
                    isLast={index === items.length - 1}
                    onOpen={() => setEditing({ item: c, isNew: false })}
                    onDelete={() => setToDelete(c)}
                    onMove={(dir) => void move(c.id, dir)}
                  />
                );
              })}
            </div>
          </section>
        </div>

        {editing && (
          <CountryDialog
            key={editing.item.id}
            item={editing.item}
            isNew={editing.isNew}
            onClose={() => setEditing(null)}
            onDelete={() => setToDelete(editing.item)}
          />
        )}

        <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && !deleting && setToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove this country?</AlertDialogTitle>
              <AlertDialogDescription>
                {toDelete?.name ? `${toDelete.name}'s` : "This"} showcase will be deleted and its pin will disappear from the homepage globe. This can't be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button onClick={() => setToDelete(null)} disabled={deleting}>
                Keep it
              </Button>
              <Button variant="destructive" onClick={() => void confirmDelete()} disabled={deleting}>
                {deleting ? "Removing…" : "Remove country"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </WriteGate>
    </AdminShell>
  );
}

/** Photo with a plain background colour behind it, like the globe backdrop. */
function Backdrop({ image, tint, alt, className }: { image: string; tint: CountryShowcase["tint"]; alt: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  const showImage = !!image && isImageUrl(image) && !broken;
  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)} style={{ backgroundColor: solidTint(tint) }}>
      {showImage ? (
        <img src={image} alt={alt} loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center text-white/80">
          <div className="text-center">
            <ImageOff className="mx-auto h-6 w-6" />
            {image && !isImageUrl(image) && <p className="mt-1 max-w-[10rem] truncate text-[0.65rem]">{image}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function CountryCard({
  item,
  position,
  canReorder,
  isFirst,
  isLast,
  onOpen,
  onDelete,
  onMove,
}: {
  item: CountryShowcase;
  position: number;
  canReorder: boolean;
  isFirst: boolean;
  isLast: boolean;
  onOpen: () => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const complete = isComplete(item);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen()}
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-colors hover:border-primary/40"
    >
      <div className="relative aspect-[16/10] w-full">
        <Backdrop image={item.image ?? ""} tint={item.tint} alt={item.name} />
        <span className="absolute left-2 top-2 rounded-full bg-primary-deep px-2 py-0.5 text-[0.65rem] font-bold text-primary-foreground">#{position}</span>
        {item.video && (
          <span className="absolute left-2 bottom-2 inline-flex items-center gap-1 rounded-full bg-card/90 px-2 py-0.5 text-[0.65rem] font-bold text-primary-deep">
            <Video className="h-3 w-3" /> Video
          </span>
        )}
        <button
          type="button"
          aria-label={`Remove ${item.name}`}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full border border-border bg-card/90 text-muted-foreground opacity-100 transition-opacity hover:border-destructive/50 hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="min-w-0 space-y-1.5 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-display text-base font-bold text-primary-deep">{item.name || "Untitled country"}</p>
          {item.name && !findCountry(item.name) ? (
            <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[0.65rem] font-bold text-red-800">Not on globe</span>
          ) : (
            !complete && <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[0.65rem] font-bold text-amber-800">Needs attention</span>
          )}
        </div>
        {item.place && <p className="truncate text-xs font-bold uppercase tracking-[0.12em] text-accent">{item.place}</p>}
        <p className="line-clamp-2 text-sm text-muted-foreground">{item.headline || "No headline yet."}</p>
        {(item.statValue || item.statLabel) && (
          <p className="truncate text-xs text-muted-foreground">
            <span className="font-bold text-primary-deep">{item.statValue}</span> {item.statLabel}
          </p>
        )}
      </div>

      {canReorder && (
        <div className="flex items-center justify-end gap-1 border-t border-border px-3 py-2">
          <button
            type="button"
            aria-label="Move earlier"
            disabled={isFirst}
            onClick={(e) => {
              e.stopPropagation();
              onMove(-1);
            }}
            className="grid h-8 w-8 place-items-center rounded-full border border-border text-muted-foreground hover:bg-primary-soft disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Move later"
            disabled={isLast}
            onClick={(e) => {
              e.stopPropagation();
              onMove(1);
            }}
            className="grid h-8 w-8 place-items-center rounded-full border border-border text-muted-foreground hover:bg-primary-soft disabled:opacity-40"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

/** Type-ahead country field. Suggestions come from the same list the globe uses, so every pick gets a pin. */
function CountryPicker({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const results = useMemo(() => searchCountries(value).slice(0, 8), [value]);
  const exact = findCountry(value);
  const showList = open && results.length > 0 && !(exact && exact.name === value.trim());

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // If they typed a known nickname (like "USA"), swap it for the proper country name.
          const match = findCountry(value);
          if (match && match.name !== value.trim()) onChange(match.name);
          setTimeout(() => setOpen(false), 120);
        }}
        placeholder="Start typing to search…"
        autoComplete="off"
        className={inputClass}
      />
      {showList && (
        <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-card shadow-lift">
          {results.map((c) => (
            <li key={c.name}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(c.name);
                  setOpen(false);
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-primary-soft"
              >
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Add / edit popup: backdrop preview on the left, write-up on the right. */
function CountryDialog({ item, isNew, onClose, onDelete }: { item: CountryShowcase; isNew: boolean; onClose: () => void; onDelete: () => void }) {
  const media = useCollection("mediaLibrary");
  const [name, setName] = useState(item.name ?? "");
  const [place, setPlace] = useState(item.place ?? "");
  const [headline, setHeadline] = useState(item.headline ?? "");
  const [blurb, setBlurb] = useState(item.blurb ?? "");
  const [detail, setDetail] = useState(item.detail ?? "");
  const [statValue, setStatValue] = useState(item.statValue ?? "");
  const [statLabel, setStatLabel] = useState(item.statLabel ?? "");
  const [points, setPoints] = useState((item.points ?? []).join("\n"));
  const [image, setImage] = useState(item.image ?? "");
  const [video, setVideo] = useState(item.video ?? "");
  const [tint, setTint] = useState<string>(item.tint as string);
  const [order, setOrder] = useState(String(item.order ?? 0));
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);

  const tintOptions: string[] = [...(TINT_COLOR_NAMES as readonly string[])];
  if (tint && !tintOptions.includes(tint)) tintOptions.unshift(tint);

  async function save() {
    if (!name.trim()) {
      toast.error("Pick a country first.");
      return;
    }
    const country = findCountry(name.trim());
    if (!country) {
      toast.error("That country isn't on the globe's list, so it would not get a pin. Pick one from the suggestions.");
      return;
    }
    setSaving(true);
    try {
      const next = {
        ...item,
        name: country.name,
        place,
        headline,
        blurb,
        detail,
        statValue,
        statLabel,
        points: points
          .split("\n")
          .map((p) => p.trim())
          .filter(Boolean),
        image,
        video: video.trim() || null,
        tint,
        order: Number(order) || 0,
      } as CountryShowcase;
      await Promise.resolve(upsertItem("countryShowcases", next));
      toast.success(isNew ? "Country added" : "Saved");
      onClose();
    } catch {
      toast.error("Could not save this country.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="flex h-[92vh] w-[96vw] max-w-6xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border p-5 text-left">
          <DialogTitle className="pr-8 font-display text-xl text-primary-deep">{isNew ? "Add country" : name || "Untitled country"}</DialogTitle>
          <DialogDescription>
            {isNew ? "Pick the country and fill in what visitors see when they tap its pin." : "Edit what visitors see when they tap this country's pin."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[2fr_3fr]">
          {/* Backdrop */}
          <div className="min-h-0 space-y-4 overflow-y-auto bg-secondary p-5">
            <div className="aspect-[16/10] w-full overflow-hidden rounded-xl border border-border">
              <Backdrop image={image} tint={tint as CountryShowcase["tint"]} alt={name} />
            </div>

            <label className="block text-sm">
              <span className={labelClass}>Backdrop photo (link or key)</span>
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

            <label className="block text-sm">
              <span className={labelClass}>Backdrop video URL (optional)</span>
              <input value={video} onChange={(e) => setVideo(e.target.value)} className={inputClass} />
            </label>

            <div>
              <p className={labelClass}>Background colour</p>
              <p className="mt-1 text-xs text-muted-foreground">Shown behind the photo while it loads, or if there is no photo. Pick the colour closest to the photo.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {tintOptions.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTint(t)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold capitalize",
                      tint === t ? "border-primary-deep bg-primary-deep text-primary-foreground" : "border-border bg-card hover:bg-primary-soft",
                    )}
                  >
                    <span aria-hidden="true" className="h-4 w-4 rounded-full border border-border" style={{ backgroundColor: solidTint(t) }} />
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Write-up */}
          <div className="min-h-0 space-y-5 overflow-y-auto border-t border-border p-5 lg:border-l lg:border-t-0">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="block text-sm">
                <span className={labelClass}>Country</span>
                <CountryPicker value={name} onChange={setName} />
                {name.trim() && !findCountry(name.trim()) ? (
                  <span className="mt-1 block text-xs font-bold text-destructive">Not on the globe's list yet, so it won't get a pin. Pick one of the suggestions.</span>
                ) : (
                  <span className="mt-1 block text-xs text-muted-foreground">Its pin appears on the homepage globe automatically.</span>
                )}
              </div>
              <label className="block text-sm">
                <span className={labelClass}>City / place</span>
                <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder='e.g. "Lagos", "Nairobi"' className={inputClass} />
                <span className="mt-1 block text-xs text-muted-foreground">The small label above the headline.</span>
              </label>
            </div>

            <label className="block text-sm">
              <span className={labelClass}>Headline</span>
              <input value={headline} onChange={(e) => setHeadline(e.target.value)} className={inputClass} />
            </label>

            <label className="block text-sm">
              <span className={labelClass}>First paragraph</span>
              <textarea value={blurb} onChange={(e) => setBlurb(e.target.value)} rows={4} className={inputClass} />
            </label>

            <label className="block text-sm">
              <span className={labelClass}>Second paragraph</span>
              <textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={4} className={inputClass} />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className={labelClass}>Stat value</span>
                <input value={statValue} onChange={(e) => setStatValue(e.target.value)} placeholder='e.g. "200+", "2016", "2 way"' className={inputClass} />
              </label>
              <label className="block text-sm">
                <span className={labelClass}>Stat label</span>
                <input value={statLabel} onChange={(e) => setStatLabel(e.target.value)} placeholder='e.g. "People employed here"' className={inputClass} />
              </label>
            </div>

            <label className="block text-sm">
              <span className={labelClass}>Bullet points</span>
              <textarea value={points} onChange={(e) => setPoints(e.target.value)} rows={6} className={inputClass} />
              <span className="mt-1 block text-xs text-muted-foreground">One point per line. They fill the card top-down, so add as many as you like.</span>
            </label>

            <label className="block max-w-[10rem] text-sm">
              <span className={labelClass}>Display order</span>
              <input type="number" value={order} onChange={(e) => setOrder(e.target.value)} className={inputClass} />
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card p-4">
          {isNew ? (
            <span />
          ) : (
            <button type="button" onClick={onDelete} className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" /> Remove country
            </button>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : isNew ? "Add country" : "Save changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}