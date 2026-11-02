import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Plus, Star, Trash2 } from "lucide-react";
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
import type { TeamMember } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/team")({
  head: () => ({
    meta: [
      { title: "Team — Blue World CMS" },
      { name: "description", content: "Manage the leadership team shown on the About pages." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Team — Blue World CMS" },
      { property: "og:description", content: "Manage leadership profiles." },
    ],
  }),
  component: TeamAdmin,
});

type Filter = "all" | "featured" | "attention";

const DEFAULT_SLUG_PLACEHOLDER = "new-leader";

const inputClass = "mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
const labelClass = "text-xs font-bold uppercase tracking-[0.14em] text-accent";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

/** Real image links preview; anything else (like a built-in asset key) shows initials instead. */
const isImageUrl = (value: string) => /^(https?:|\/|data:)/.test(value);

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("") || "?";

const needsAttention = (m: TeamMember) => !m.photo || !m.bio;

function TeamAdmin() {
  const collection = useCollection("teamMembers");
  const members = useMemo(() => [...collection].sort((a, b) => a.order - b.order), [collection]);

  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{ member: TeamMember; isNew: boolean } | null>(null);
  const [toDelete, setToDelete] = useState<TeamMember | null>(null);
  const [deleting, setDeleting] = useState(false);

  const sidebar: { slug: Filter; title: string; hint: string; count: number }[] = [
    { slug: "all", title: "Everyone", hint: "", count: members.length },
    { slug: "featured", title: "Top leader", hint: "Spotlighted first on the Leadership page", count: members.filter((m) => m.isFeatured).length },
    { slug: "attention", title: "Needs attention", hint: "Missing a photo or write-up", count: members.filter(needsAttention).length },
  ];

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((m) => {
      if (filter === "featured" && !m.isFeatured) return false;
      if (filter === "attention" && !needsAttention(m)) return false;
      return !q || [m.name, m.role].some((v) => (v ?? "").toLowerCase().includes(q));
    });
  }, [members, filter, query]);

  // Moving a card only makes sense when the grid shows the full list in its real order.
  const canReorder = filter === "all" && !query.trim();

  function startNew() {
    setEditing({
      isNew: true,
      member: {
        id: newId("t"),
        name: "",
        slug: DEFAULT_SLUG_PLACEHOLDER,
        role: "",
        bio: "",
        photo: "",
        order: members.length + 1,
        isFeatured: false,
      } as TeamMember,
    });
  }

  async function move(id: string, dir: -1 | 1) {
    const from = members.findIndex((m) => m.id === id);
    const to = from + dir;
    if (from < 0 || to < 0 || to >= members.length) return;
    const next = [...members];
    [next[from], next[to]] = [next[to]!, next[from]!];
    try {
      // Renumber from 1 so the order stays clean even if the old numbers had gaps or ties.
      await Promise.all(next.map((m, i) => (m.order === i + 1 ? null : Promise.resolve(upsertItem("teamMembers", { ...m, order: i + 1 })))));
    } catch {
      toast.error("Could not change the order.");
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await Promise.resolve(deleteItem("teamMembers", toDelete.id));
      if (editing?.member.id === toDelete.id) setEditing(null);
      toast.success("Team member removed");
      setToDelete(null);
    } catch {
      toast.error("Could not remove this person.");
    } finally {
      setDeleting(false);
    }
  }

  const selectedTitle = sidebar.find((s) => s.slug === filter)?.title ?? "Everyone";

  return (
    <AdminShell title="Team" description="Executives listed on About Us → Leadership. Open a card to edit, use the arrows to change the order.">
      <WriteGate resource="team">
        <div className="grid gap-6 lg:grid-cols-[270px_minmax(0,1fr)]">
          {/* Groups */}
          <aside className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {sidebar.map((s) => (
              <button
                key={s.slug}
                type="button"
                onClick={() => setFilter(s.slug)}
                className={cn(
                  "flex shrink-0 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors lg:shrink",
                  filter === s.slug ? "border-primary-deep bg-primary-deep text-primary-foreground" : "border-border bg-card hover:bg-primary-soft",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">{s.title}</span>
                  {s.hint && (
                    <span className={cn("hidden truncate text-xs lg:block", filter === s.slug ? "text-primary-foreground/70" : "text-muted-foreground")}>{s.hint}</span>
                  )}
                </span>
                {s.slug === "attention" && s.count > 0 ? (
                  <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[0.65rem] font-bold text-accent-foreground">{s.count}</span>
                ) : (
                  <span className={cn("shrink-0 text-xs font-bold", filter === s.slug ? "text-primary-foreground/80" : "text-muted-foreground")}>{s.count}</span>
                )}
              </button>
            ))}
          </aside>

          {/* People */}
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
                  placeholder="Search name or job title…"
                  className="min-w-0 flex-1 rounded-full border border-border bg-background px-4 py-1.5 text-sm sm:w-56 sm:flex-none"
                />
                <Button onClick={startNew}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add team member
                </Button>
              </div>
            </div>

            {shown.length === 0 && (
              <p className="rounded-2xl border border-border bg-card p-6 text-sm text-foreground/60">
                {members.length === 0 ? "No team members yet. Add the first one." : "No one matches."}
              </p>
            )}

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {shown.map((m) => {
                const index = members.findIndex((x) => x.id === m.id);
                return (
                  <MemberCard
                    key={m.id}
                    member={m}
                    position={index + 1}
                    canReorder={canReorder}
                    isFirst={index === 0}
                    isLast={index === members.length - 1}
                    onOpen={() => setEditing({ member: m, isNew: false })}
                    onDelete={() => setToDelete(m)}
                    onMove={(dir) => void move(m.id, dir)}
                  />
                );
              })}
            </div>
          </section>
        </div>

        {editing && (
          <MemberDialog
            key={editing.member.id}
            member={editing.member}
            isNew={editing.isNew}
            others={members.filter((m) => m.id !== editing.member.id)}
            onClose={() => setEditing(null)}
            onDelete={() => setToDelete(editing.member)}
          />
        )}

        <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && !deleting && setToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove this person?</AlertDialogTitle>
              <AlertDialogDescription>
                {toDelete?.name ? `${toDelete.name}'s` : "This"} profile will be removed from the Leadership page and their own profile page will stop working. This can't be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button onClick={() => setToDelete(null)} disabled={deleting}>
                Keep them
              </Button>
              <Button variant="destructive" onClick={() => void confirmDelete()} disabled={deleting}>
                {deleting ? "Removing…" : "Remove person"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </WriteGate>
    </AdminShell>
  );
}

/** Photo, or the person's initials when there is no usable photo. */
function Portrait({ src, name, className }: { src: string; name: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (src && isImageUrl(src) && !broken) {
    return <img src={src} alt={name} loading="lazy" onError={() => setBroken(true)} className={cn("h-full w-full object-cover object-top", className)} />;
  }
  return (
    <div className="grid h-full w-full place-items-center bg-primary-soft">
      <span className="font-display text-4xl font-bold text-primary-deep/60">{initials(name)}</span>
    </div>
  );
}

function MemberCard({
  member,
  position,
  canReorder,
  isFirst,
  isLast,
  onOpen,
  onDelete,
  onMove,
}: {
  member: TeamMember;
  position: number;
  canReorder: boolean;
  isFirst: boolean;
  isLast: boolean;
  onOpen: () => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen()}
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-colors hover:border-primary/40"
    >
      <div className="relative aspect-[4/5] w-full bg-secondary">
        <Portrait src={member.photo ?? ""} name={member.name} />
        <span className="absolute left-2 top-2 rounded-full bg-primary-deep px-2 py-0.5 text-[0.65rem] font-bold text-primary-foreground">#{position}</span>
        {member.isFeatured && (
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[0.65rem] font-bold text-accent-foreground">
            <Star className="h-3 w-3" /> Top leader
          </span>
        )}
        <button
          type="button"
          aria-label={`Remove ${member.name}`}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full border border-border bg-card/90 text-muted-foreground opacity-100 transition-opacity hover:border-destructive/50 hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="min-w-0 space-y-1 p-3">
        <p className="truncate font-display text-sm font-bold text-primary-deep">{member.name || "Unnamed"}</p>
        <p className="truncate text-xs text-muted-foreground">{member.role || "No job title yet"}</p>
        {needsAttention(member) && (
          <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[0.65rem] font-bold text-amber-800">
            {!member.photo && !member.bio ? "Needs photo and write-up" : !member.photo ? "Needs photo" : "Needs write-up"}
          </span>
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

/** Add / edit popup: photo on the left, details on the right. */
function MemberDialog({
  member,
  isNew,
  others,
  onClose,
  onDelete,
}: {
  member: TeamMember;
  isNew: boolean;
  others: TeamMember[];
  onClose: () => void;
  onDelete: () => void;
}) {
  const media = useCollection("mediaLibrary");
  const [name, setName] = useState(member.name ?? "");
  const [role, setRole] = useState(member.role ?? "");
  const [isFeatured, setIsFeatured] = useState(!!member.isFeatured);
  const [bio, setBio] = useState(member.bio ?? "");
  const [photo, setPhoto] = useState(member.photo ?? "");
  const [order, setOrder] = useState(String(member.order ?? 1));
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);

  const otherFeatured = others.filter((m) => m.isFeatured);

  async function save() {
    if (!name.trim()) {
      toast.error("Add the person's full name first.");
      return;
    }
    setSaving(true);
    try {
      // The web address of their profile page is made from their name the first time, then left alone.
      let slug = member.slug;
      if (!slug || slug === DEFAULT_SLUG_PLACEHOLDER) {
        const base = slugify(name) || newId("leader");
        slug = base;
        let n = 2;
        while (others.some((m) => m.slug === slug)) slug = `${base}-${n++}`;
      }
      await Promise.resolve(
        upsertItem("teamMembers", {
          ...member,
          name: name.trim(),
          slug,
          role,
          bio,
          photo,
          order: Number(order) || 0,
          isFeatured,
        } as TeamMember),
      );
      toast.success(isNew ? "Team member added" : "Saved");
      onClose();
    } catch {
      toast.error("Could not save this person.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className={cn(EDITOR_DIALOG_CLASS, "sm:max-w-5xl")}>
        <DialogHeader className="border-b border-border p-5 text-left">
          <DialogTitle className="pr-8 font-display text-xl text-primary-deep">{isNew ? "Add team member" : name || "Unnamed"}</DialogTitle>
          <DialogDescription>{isNew ? "Add their details and photo." : "Edit this person's profile."}</DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 content-start overflow-y-auto lg:grid-cols-[2fr_3fr] lg:overflow-hidden">
          {/* Photo */}
          <div className="min-h-0 space-y-4 overflow-y-auto bg-secondary p-5">
            <div className="mx-auto aspect-[4/5] w-full max-w-xs overflow-hidden rounded-xl border border-border bg-card">
              <Portrait src={photo} name={name} className="object-cover" />
            </div>

            <label className="block text-sm">
              <span className={labelClass}>Photo (link or key)</span>
              <input value={photo} onChange={(e) => setPhoto(e.target.value)} className={inputClass} />
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
                    onClick={() => setPhoto(m.url)}
                    className={cn(
                      "aspect-square overflow-hidden rounded-lg border-2 bg-secondary",
                      photo === m.url ? "border-accent" : "border-transparent hover:border-primary/40",
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
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className={labelClass}>Full name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
              </label>
              <label className="block text-sm">
                <span className={labelClass}>Job title</span>
                <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Chief Executive Officer" className={inputClass} />
              </label>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setIsFeatured((v) => !v)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold",
                  isFeatured ? "border-accent bg-accent text-accent-foreground" : "border-border hover:bg-primary-soft",
                )}
              >
                <Star className="h-4 w-4" />
                {isFeatured ? "Featured as top leader" : "Not featured as top leader"}
              </button>
              <p className="mt-2 text-xs text-muted-foreground">
                Spotlights this person first on the Leadership page, with their photo and a longer statement. Use it for the Founder, MD or Chief Visionary. Normally only one person
                is turned on.
              </p>
              {isFeatured && otherFeatured.length > 0 && (
                <p className="mt-2 text-xs font-bold text-amber-800">
                  {otherFeatured.map((m) => m.name).join(", ")} {otherFeatured.length === 1 ? "is" : "are"} already featured. Turn {otherFeatured.length === 1 ? "that one" : "those"} off if only one
                  person should be spotlighted.
                </p>
              )}
            </div>

            <label className="block text-sm">
              <span className={labelClass}>Full write-up</span>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={8} className={inputClass} />
              <span className="mt-1 block text-xs text-muted-foreground">
                Shown on their own profile page, and as the statement if they're the top leader. Leave a blank line between paragraphs.
              </span>
            </label>

            <label className="block max-w-[10rem] text-sm">
              <span className={labelClass}>Display order</span>
              <input type="number" value={order} onChange={(e) => setOrder(e.target.value)} className={inputClass} />
              <span className="mt-1 block text-xs text-muted-foreground">Lower numbers appear first.</span>
            </label>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          {isNew ? (
            <span />
          ) : (
            <button type="button" onClick={onDelete} className="inline-flex min-h-10 items-center justify-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" /> Remove person
            </button>
          )}
          <div className="flex gap-2 [&>button]:flex-1 sm:[&>button]:flex-none">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : isNew ? "Add team member" : "Save changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}