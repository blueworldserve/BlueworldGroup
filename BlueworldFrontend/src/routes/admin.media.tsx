import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Copy, ImageOff, Loader2, Trash2, UploadCloud } from "lucide-react";
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
import { addUploadedMedia, deleteItem, upsertItem, useCollection } from "@/lib/cms-store";
import { uploadMedia } from "@/lib/api";
import type { MediaAsset } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/media")({
  head: () => ({
    meta: [
      { title: "Media Library — Blue World CMS" },
      { name: "description", content: "Track every image used across the Blue World Cosmetics site." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Media Library — Blue World CMS" },
      { property: "og:description", content: "Image assets and where they are used." },
    ],
  }),
  component: MediaAdmin,
});

const MEDIA_USAGE_AREAS = [
  "Hero Slides",
  "Business Units",
  "Products",
  "Team",
  "Blog Posts",
  "Site Logo / Settings",
  "Admin Login Background",
] as const;

const UNASSIGNED = "__unassigned__";

/** usedOn may be stored as a comma-separated string or as an array; read both. */
function parseUsed(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function MediaAdmin() {
  const assets = useCollection("mediaLibrary");
  const [area, setArea] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<MediaAsset | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Sidebar: the known areas, plus any extra area that already exists in the data.
  const areas = useMemo(() => {
    const names: string[] = [...MEDIA_USAGE_AREAS];
    for (const a of assets) {
      for (const name of parseUsed(a.usedOn)) if (!names.includes(name)) names.push(name);
    }
    return names.map((name) => ({
      slug: name,
      title: name,
      count: assets.filter((a) => parseUsed(a.usedOn).includes(name)).length,
    }));
  }, [assets]);

  const unassignedCount = useMemo(() => assets.filter((a) => parseUsed(a.usedOn).length === 0).length, [assets]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter((a) => {
      const used = parseUsed(a.usedOn);
      const inArea = area === "all" ? true : area === UNASSIGNED ? used.length === 0 : used.includes(area);
      const matches = !q || [a.filename, a.localPath ?? "", used.join(" ")].some((v) => v.toLowerCase().includes(q));
      return inArea && matches;
    });
  }, [assets, area, query]);

  const open = assets.find((a) => a.id === openId) ?? null;

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await Promise.resolve(deleteItem("mediaLibrary", toDelete.id));
      if (openId === toDelete.id) setOpenId(null);
      toast.success("Image deleted");
      setToDelete(null);
    } catch {
      toast.error("Could not delete this image.");
    } finally {
      setDeleting(false);
    }
  }

  const sidebar = [
    { slug: "all", title: "All images", count: assets.length },
    ...areas,
    { slug: UNASSIGNED, title: "Not tagged yet", count: unassignedCount },
  ];
  const selectedTitle = sidebar.find((s) => s.slug === area)?.title ?? "All images";

  return (
    <AdminShell
      title="Media Library"
      description="Upload images directly — they're stored on Cloudinary. Filter by where they're used, open one to edit its details."
    >
      <WriteGate resource="media-upload" notice={false}>
        <UploadPanel />
      </WriteGate>

      <WriteGate resource="media">
        <div className="grid gap-6 lg:grid-cols-[270px_minmax(0,1fr)]">
          {/* Areas */}
          <aside className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {sidebar.map((s) => (
              <button
                key={s.slug}
                type="button"
                onClick={() => setArea(s.slug)}
                className={cn(
                  "flex shrink-0 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors lg:shrink",
                  area === s.slug ? "border-primary-deep bg-primary-deep text-primary-foreground" : "border-border bg-card hover:bg-primary-soft",
                )}
              >
                <span className="min-w-0 truncate text-sm font-bold">{s.title}</span>
                <span className={cn("shrink-0 text-xs font-bold", area === s.slug ? "text-primary-foreground/80" : "text-muted-foreground")}>{s.count}</span>
              </button>
            ))}
          </aside>

          {/* Image grid */}
          <section className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold text-primary-deep">
                {selectedTitle} <span className="font-normal text-muted-foreground">· {shown.length}</span>
              </h2>
              <input
                type="search"
                enterKeyHint="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search filename or area…"
                className="w-full rounded-full border border-border bg-background px-4 py-1.5 text-sm sm:w-60"
              />
            </div>

            {shown.length === 0 && (
              <p className="rounded-2xl border border-border bg-card p-6 text-sm text-foreground/60">
                {assets.length === 0 ? "No images yet. Upload one above." : "No images match."}
              </p>
            )}

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {shown.map((a) => (
                <MediaCard key={a.id} asset={a} onOpen={() => setOpenId(a.id)} onDelete={() => setToDelete(a)} />
              ))}
            </div>
          </section>
        </div>

        {open && <MediaDialog key={open.id} asset={open} onClose={() => setOpenId(null)} onDelete={() => setToDelete(open)} />}

        <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && !deleting && setToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this image?</AlertDialogTitle>
              <AlertDialogDescription>
                {toDelete?.filename ? `"${toDelete.filename}"` : "This image"} will be removed from the library. Anywhere it is used on the site may show a
                broken image. This can't be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button onClick={() => setToDelete(null)} disabled={deleting}>
                Keep it
              </Button>
              <Button variant="destructive" onClick={() => void confirmDelete()} disabled={deleting}>
                {deleting ? "Deleting…" : "Delete image"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </WriteGate>
    </AdminShell>
  );
}

function MediaCard({ asset, onOpen, onDelete }: { asset: MediaAsset; onOpen: () => void; onDelete: () => void }) {
  const used = parseUsed(asset.usedOn);
  const [broken, setBroken] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen()}
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-colors hover:border-primary/40"
    >
      <div className="relative aspect-[4/3] w-full bg-secondary">
        {asset.url && !broken ? (
          <img src={asset.url} alt={asset.filename} loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-muted-foreground">
            <ImageOff className="h-6 w-6" />
          </div>
        )}
        <button
          type="button"
          aria-label={`Delete ${asset.filename}`}
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
        <p className="truncate text-sm font-bold text-primary-deep">{asset.filename || "Untitled"}</p>
        {asset.width > 0 && asset.height > 0 && (
          <p className="text-xs text-muted-foreground">
            {asset.width} × {asset.height}
          </p>
        )}
        <div className="flex flex-wrap gap-1">
          {used.length === 0 && <span className="rounded-full bg-secondary px-2 py-0.5 text-[0.65rem] font-bold text-muted-foreground">Not tagged</span>}
          {used.slice(0, 2).map((u) => (
            <span key={u} className="rounded-full bg-primary-soft px-2 py-0.5 text-[0.65rem] font-bold text-primary-deep">
              {u}
            </span>
          ))}
          {used.length > 2 && <span className="rounded-full bg-secondary px-2 py-0.5 text-[0.65rem] font-bold text-muted-foreground">+{used.length - 2}</span>}
        </div>
      </div>
    </div>
  );
}

/** Image on the left, editable details on the right. */
function MediaDialog({ asset, onClose, onDelete }: { asset: MediaAsset; onClose: () => void; onDelete: () => void }) {
  const [filename, setFilename] = useState(asset.filename ?? "");
  const [url, setUrl] = useState(asset.url ?? "");
  const [localPath, setLocalPath] = useState(asset.localPath ?? "");
  const [width, setWidth] = useState(String(asset.width ?? 0));
  const [height, setHeight] = useState(String(asset.height ?? 0));
  const [used, setUsed] = useState<string[]>(parseUsed(asset.usedOn));
  const [saving, setSaving] = useState(false);

  const allAreas = [...MEDIA_USAGE_AREAS, ...used.filter((u) => !(MEDIA_USAGE_AREAS as readonly string[]).includes(u))];

  function toggle(name: string) {
    setUsed((prev) => (prev.includes(name) ? prev.filter((u) => u !== name) : [...prev, name]));
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Image link copied");
    } catch {
      toast.error("Could not copy the link.");
    }
  }

  async function save() {
    setSaving(true);
    try {
      // Keep usedOn in whatever shape this asset already used (array or comma-separated string).
      const usedOn = (Array.isArray(asset.usedOn) ? used : used.join(", ")) as MediaAsset["usedOn"];
      await Promise.resolve(
        upsertItem("mediaLibrary", {
          ...asset,
          filename: filename.trim(),
          url: url.trim(),
          localPath,
          width: Number(width) || 0,
          height: Number(height) || 0,
          usedOn,
        }),
      );
      toast.success("Saved");
      onClose();
    } catch {
      toast.error("Could not save changes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className={cn(EDITOR_DIALOG_CLASS, "sm:max-w-5xl")}>
        <DialogHeader className="border-b border-border p-5 text-left">
          <DialogTitle className="pr-8 font-display text-xl text-primary-deep">{asset.filename || "Untitled image"}</DialogTitle>
          <DialogDescription>Edit the details and tag where this image is used.</DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 content-start overflow-y-auto lg:grid-cols-[3fr_minmax(320px,2fr)] lg:overflow-hidden">
          {/* Preview */}
          <div className="flex min-h-0 items-center justify-center bg-secondary p-4">
            {url ? (
              <img src={url} alt={filename} className="max-h-[40dvh] max-w-full rounded-lg object-contain lg:max-h-full" />
            ) : (
              <ImageOff className="h-10 w-10 text-muted-foreground" />
            )}
          </div>

          {/* Details */}
          <div className="min-h-0 space-y-5 overflow-y-auto border-t border-border p-5 lg:border-l lg:border-t-0">
            <label className="block text-sm">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Filename</span>
              <input value={filename} onChange={(e) => setFilename(e.target.value)} className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </label>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Where is this used?</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {allAreas.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggle(name)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-bold",
                      used.includes(name) ? "border-primary-deep bg-primary-deep text-primary-foreground" : "border-border hover:bg-primary-soft",
                    )}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Width</span>
                <input type="number" value={width} onChange={(e) => setWidth(e.target.value)} className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </label>
              <label className="block text-sm">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Height</span>
                <input type="number" value={height} onChange={(e) => setHeight(e.target.value)} className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </label>
            </div>

            <label className="block text-sm">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Image link</span>
              <input value={url} onChange={(e) => setUrl(e.target.value)} className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              <span className="mt-1 block text-xs text-muted-foreground">Set automatically by upload. Edit only if replacing a broken link.</span>
            </label>

            <label className="block text-sm">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Local path</span>
              <input value={localPath} onChange={(e) => setLocalPath(e.target.value)} className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              <span className="mt-1 block text-xs text-muted-foreground">Legacy field. Leave blank for uploaded assets.</span>
            </label>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" onClick={onDelete} className="inline-flex min-h-10 items-center justify-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" /> Delete image
          </button>
          <div className="flex gap-2 [&>button]:flex-1 sm:[&>button]:flex-none">
            <Button variant="outline" onClick={() => void copyUrl()} disabled={!url}>
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              Copy link
            </Button>
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function UploadPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    if (list.some((f) => !f.type.startsWith("image/"))) {
      toast.error("Please upload image files only.");
      return;
    }
    setUploading(true);
    let done = 0;
    for (const file of list) {
      try {
        const asset = await uploadMedia(file);
        addUploadedMedia(asset);
        done += 1;
      } catch {
        toast.error(`Upload failed for ${file.name}. Check your connection or permissions.`);
      }
    }
    if (done > 0) toast.success(done === 1 ? "Image uploaded" : `${done} images uploaded`);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        void handleFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "mb-6 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-colors",
        dragOver ? "border-accent bg-primary-soft" : "border-border bg-card hover:border-accent/60",
      )}
    >
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void handleFiles(e.target.files)} />
      {uploading ? <Loader2 className="h-8 w-8 animate-spin text-accent" /> : <UploadCloud className="h-8 w-8 text-accent" />}
      <p className="mt-3 text-sm font-semibold text-primary-deep">{uploading ? "Uploading…" : "Drag images here, or click to browse"}</p>
      <p className="mt-1 text-xs text-muted-foreground">Uploads go straight to Cloudinary. You can pick several at once.</p>
    </div>
  );
}