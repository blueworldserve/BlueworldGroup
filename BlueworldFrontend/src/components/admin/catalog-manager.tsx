import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Plus, Trash2, X } from "lucide-react";
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
import { CmsImage } from "@/components/site/primitives";
import { CountryField } from "@/components/admin/country-field";
import { VideoField, type FieldConfig } from "@/components/admin/resource-manager";
import { useCollection } from "@/lib/cms-store";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

/** Same as the old FieldConfig, plus `half` to put two short fields side by side. */
export interface CatalogField<T> extends FieldConfig<T> {
  half?: boolean;
}

/** One button in the left sidebar. The "All" button is added automatically. */
export interface CatalogGroup<T> {
  key: string;
  title: string;
  hint?: string;
  match: (item: T) => boolean;
  /** Show the count as an orange pill when it's above zero (e.g. "Needs attention"). */
  alert?: boolean;
}

export interface CatalogBadge {
  label: string;
  tone?: "primary" | "accent" | "warn" | "muted";
}

type Aspect = "square" | "portrait" | "landscape";

const ASPECT_CLASS: Record<Aspect, string> = {
  square: "aspect-square",
  portrait: "aspect-[4/5]",
  landscape: "aspect-[16/10]",
};

const PREVIEW_WIDTH: Record<Aspect, string> = {
  square: "max-w-sm",
  portrait: "max-w-xs",
  landscape: "max-w-md",
};

const inputClass =
  "mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";
const labelClass = "text-xs font-bold uppercase tracking-[0.14em] text-accent";

const BADGE_TONE: Record<NonNullable<CatalogBadge["tone"]>, string> = {
  primary: "bg-primary-soft text-primary-deep",
  accent: "bg-accent text-accent-foreground",
  warn: "bg-amber-100 text-amber-800",
  muted: "bg-secondary text-muted-foreground",
};

const asRecord = (item: unknown) => item as Record<string, unknown>;

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

export function CatalogManager<T extends { id: string }>({
  items,
  singular,
  allLabel,
  fields,
  emptyItem,
  onSave,
  onDelete,
  getTitle,
  getSubtitle,
  getImage,
  imageField,
  imageAspect = "landscape",
  getBadges,
  groups = [],
  pills,
  searchText,
  searchPlaceholder = "Search…",
  reorder,
  validate,
  deleteNote,
  allowCreate = true,
  canDelete = true,
}: {
  /** Already in the order you want them shown. */
  items: T[];
  /** "Post", "Slide", "Job"… used in buttons and messages. */
  singular: string;
  /** Label of the first sidebar button, e.g. "All posts". */
  allLabel: string;
  fields: CatalogField<T>[];
  emptyItem: () => T;
  onSave: (item: T) => void | Promise<unknown>;
  onDelete: (id: string) => void | Promise<unknown>;
  getTitle: (item: T) => string;
  getSubtitle?: (item: T) => string;
  /** Leave out for records with no picture (like jobs). */
  getImage?: (item: T) => string;
  /** The field that holds the main picture. It gets the big left panel in the popup. */
  imageField?: keyof T & string;
  imageAspect?: Aspect;
  getBadges?: (item: T) => CatalogBadge[];
  groups?: CatalogGroup<T>[];
  /** Pills under the heading, built from the values that exist in the selected group. */
  pills?: { allLabel: string; get: (item: T) => string | undefined };
  searchText: (item: T) => (string | undefined)[];
  searchPlaceholder?: string;
  /** Turns on the arrows. `field` is the number field that stores the order. */
  reorder?: { field: keyof T & string; start?: number };
  /** Return a message to block saving, or null when everything is fine. */
  validate?: (item: T) => string | null;
  /** Extra sentence in the delete confirmation. */
  deleteNote?: string;
  allowCreate?: boolean;
  canDelete?: boolean;
}) {
  const [groupKey, setGroupKey] = useState("all");
  const [pill, setPill] = useState("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{ item: T; isNew: boolean } | null>(null);
  const [toDelete, setToDelete] = useState<T | null>(null);
  const [deleting, setDeleting] = useState(false);

  const sidebar = useMemo(
    () => [
      { key: "all", title: allLabel, hint: "", alert: false, count: items.length },
      ...groups.map((g) => ({ key: g.key, title: g.title, hint: g.hint ?? "", alert: !!g.alert, count: items.filter(g.match).length })),
    ],
    [items, groups, allLabel],
  );

  const inGroup = useMemo(() => {
    const g = groups.find((x) => x.key === groupKey);
    return g ? items.filter(g.match) : items;
  }, [items, groups, groupKey]);

  const pillValues = useMemo(() => {
    if (!pills) return [];
    return Array.from(new Set(inGroup.map((i) => pills.get(i)).filter((v): v is string => !!v))).sort();
  }, [inGroup, pills]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inGroup.filter(
      (i) =>
        (pill === "all" || !pills || pills.get(i) === pill) &&
        (!q || searchText(i).some((v) => (v ?? "").toLowerCase().includes(q))),
    );
  }, [inGroup, pill, pills, query, searchText]);

  // Moving a card only makes sense when the grid shows the full list in its real order.
  const canReorder = !!reorder && groupKey === "all" && pill === "all" && !query.trim();
  const hasImage = !!getImage;
  const selectedTitle = sidebar.find((s) => s.key === groupKey)?.title ?? allLabel;

  function pickGroup(key: string) {
    setGroupKey(key);
    setPill("all");
  }

  async function move(id: string, dir: -1 | 1) {
    if (!reorder) return;
    const from = items.findIndex((i) => i.id === id);
    const to = from + dir;
    if (from < 0 || to < 0 || to >= items.length) return;
    const next = [...items];
    [next[from], next[to]] = [next[to]!, next[from]!];
    const start = reorder.start ?? 1;
    try {
      // Renumber everything so the order stays clean even if the old numbers had gaps or ties.
      await Promise.all(
        next.map((it, i) =>
          asRecord(it)[reorder.field] === start + i ? null : Promise.resolve(onSave({ ...it, [reorder.field]: start + i } as T)),
        ),
      );
    } catch {
      toast.error("Could not change the order.");
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await Promise.resolve(onDelete(toDelete.id));
      if (editing?.item.id === toDelete.id) setEditing(null);
      toast.success(`${singular} deleted`);
      setToDelete(null);
    } catch {
      toast.error(`Could not delete this ${singular.toLowerCase()}.`);
    } finally {
      setDeleting(false);
    }
  }

  const gridClass =
    hasImage && imageAspect !== "landscape"
      ? "grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4"
      : "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3";

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[270px_minmax(0,1fr)]">
        {/* Groups */}
        <aside className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
          {sidebar.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => pickGroup(s.key)}
              className={cn(
                "flex shrink-0 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors lg:shrink",
                groupKey === s.key ? "border-primary-deep bg-primary-deep text-primary-foreground" : "border-border bg-card hover:bg-primary-soft",
              )}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">{s.title}</span>
                {s.hint && (
                  <span className={cn("hidden truncate text-xs lg:block", groupKey === s.key ? "text-primary-foreground/70" : "text-muted-foreground")}>
                    {s.hint}
                  </span>
                )}
              </span>
              {s.alert && s.count > 0 ? (
                <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[0.65rem] font-bold text-accent-foreground">{s.count}</span>
              ) : (
                <span className={cn("shrink-0 text-xs font-bold", groupKey === s.key ? "text-primary-foreground/80" : "text-muted-foreground")}>{s.count}</span>
              )}
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
                placeholder={searchPlaceholder}
                className="w-56 rounded-full border border-border bg-background px-4 py-1.5 text-sm"
              />
              {allowCreate && (
                <Button onClick={() => setEditing({ item: emptyItem(), isNew: true })}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add {singular.toLowerCase()}
                </Button>
              )}
            </div>
          </div>

          {pills && pillValues.length > 1 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {["all", ...pillValues].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setPill(v)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-bold",
                    pill === v ? "border-primary-deep bg-primary-deep text-primary-foreground" : "border-border hover:bg-primary-soft",
                  )}
                >
                  {v === "all" ? pills.allLabel : v}
                </button>
              ))}
            </div>
          )}

          {shown.length === 0 && (
            <p className="rounded-2xl border border-border bg-card p-6 text-sm text-foreground/60">
              {items.length === 0 ? `Nothing here yet. Add the first ${singular.toLowerCase()}.` : "Nothing matches."}
            </p>
          )}

          <div className={gridClass}>
            {shown.map((item) => {
              const index = items.findIndex((x) => x.id === item.id);
              return (
                <CatalogCard
                  key={item.id}
                  title={getTitle(item) || `Untitled ${singular.toLowerCase()}`}
                  subtitle={getSubtitle?.(item) ?? ""}
                  image={hasImage ? getImage(item) : undefined}
                  aspect={imageAspect}
                  badges={getBadges?.(item) ?? []}
                  position={canReorder ? index + 1 : undefined}
                  canReorder={canReorder}
                  isFirst={index === 0}
                  isLast={index === items.length - 1}
                  canDelete={canDelete}
                  onOpen={() => setEditing({ item, isNew: false })}
                  onDelete={() => setToDelete(item)}
                  onMove={(dir) => void move(item.id, dir)}
                />
              );
            })}
          </div>
        </section>
      </div>

      {editing && (
        <CatalogDialog<T>
          key={editing.item.id}
          record={editing.item}
          isNew={editing.isNew}
          singular={singular}
          fields={fields}
          imageField={imageField}
          imageAspect={imageAspect}
          getTitle={getTitle}
          validate={validate}
          canDelete={canDelete}
          onSave={onSave}
          onClose={() => setEditing(null)}
          onDelete={() => setToDelete(editing.item)}
        />
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && !deleting && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {singular.toLowerCase()}?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete && getTitle(toDelete) ? `"${getTitle(toDelete)}"` : `This ${singular.toLowerCase()}`} will be removed.{" "}
              {deleteNote ? `${deleteNote} ` : ""}This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button onClick={() => setToDelete(null)} disabled={deleting}>
              Keep it
            </Button>
            <Button variant="destructive" onClick={() => void confirmDelete()} disabled={deleting}>
              {deleting ? "Deleting…" : `Delete ${singular.toLowerCase()}`}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

function CatalogCard({
  title,
  subtitle,
  image,
  aspect,
  badges,
  position,
  canReorder,
  isFirst,
  isLast,
  canDelete,
  onOpen,
  onDelete,
  onMove,
}: {
  title: string;
  subtitle: string;
  image: string | undefined;
  aspect: Aspect;
  badges: CatalogBadge[];
  position: number | undefined;
  canReorder: boolean;
  isFirst: boolean;
  isLast: boolean;
  canDelete: boolean;
  onOpen: () => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const withImage = image !== undefined;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen()}
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-colors hover:border-primary/40"
    >
      {withImage && (
        <div className={cn("relative w-full bg-secondary", ASPECT_CLASS[aspect])}>
          <CmsImage src={image} alt={title} className="h-full w-full object-cover" />
          {position !== undefined && (
            <span className="absolute left-2 top-2 rounded-full bg-primary-deep px-2 py-0.5 text-[0.65rem] font-bold text-primary-foreground">#{position}</span>
          )}
        </div>
      )}

      {canDelete && (
        <button
          type="button"
          aria-label={`Delete ${title}`}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full border border-border bg-card/90 text-muted-foreground opacity-100 transition-opacity hover:border-destructive/50 hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}

      <div className={cn("min-w-0 space-y-1.5 p-3", !withImage && "pr-12")}>
        {!withImage && position !== undefined && (
          <span className="inline-block rounded-full bg-primary-deep px-2 py-0.5 text-[0.65rem] font-bold text-primary-foreground">#{position}</span>
        )}
        <p className="truncate font-display text-sm font-bold text-primary-deep">{title}</p>
        {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
        {badges.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {badges.map((b) => (
              <span key={b.label} className={cn("rounded-full px-2 py-0.5 text-[0.65rem] font-bold", BADGE_TONE[b.tone ?? "primary"])}>
                {b.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {canReorder && (
        <div className="mt-auto flex items-center justify-end gap-1 border-t border-border px-3 py-2">
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

/* ------------------------------------------------------------------ */
/* Popup                                                               */
/* ------------------------------------------------------------------ */

function CatalogDialog<T extends { id: string }>({
  record,
  isNew,
  singular,
  fields,
  imageField,
  imageAspect,
  getTitle,
  validate,
  canDelete,
  onSave,
  onClose,
  onDelete,
}: {
  record: T;
  isNew: boolean;
  singular: string;
  fields: CatalogField<T>[];
  imageField?: (keyof T & string) | undefined;
  imageAspect: Aspect;
  getTitle: (item: T) => string;
  validate?: ((item: T) => string | null) | undefined;
  canDelete: boolean;
  onSave: (item: T) => void | Promise<unknown>;
  onClose: () => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<T>(record);
  const [saving, setSaving] = useState(false);
  const noun = singular.toLowerCase();

  function set(name: string, value: unknown) {
    setDraft((d) => ({ ...d, [name]: value }));
  }

  async function save() {
    const problem = validate?.(draft);
    if (problem) {
      toast.error(problem);
      return;
    }
    setSaving(true);
    try {
      await Promise.resolve(onSave(draft));
      toast.success(isNew ? `${singular} added` : "Saved");
      onClose();
    } catch {
      toast.error(`Could not save this ${noun}.`);
    } finally {
      setSaving(false);
    }
  }

  const detailFields = fields.filter((f) => f.name !== imageField && (!f.showIf || f.showIf(draft)));
  const title = getTitle(draft);

  const details = (
    <div className="grid gap-x-3 gap-y-5 sm:grid-cols-2">
      {detailFields.map((field) => (
        <div key={field.name} className={cn(!field.half && "sm:col-span-2")}>
          <FieldControl field={field} draft={draft} onChange={(v) => set(field.name, v)} />
        </div>
      ))}
    </div>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className={cn("flex h-[92vh] w-[96vw] flex-col gap-0 overflow-hidden p-0", imageField ? "max-w-5xl" : "max-w-3xl")}>
        <DialogHeader className="border-b border-border p-5 text-left">
          <DialogTitle className="pr-8 font-display text-xl text-primary-deep">{isNew ? `Add ${noun}` : title || `Untitled ${noun}`}</DialogTitle>
          <DialogDescription>{isNew ? "Fill in the details below." : `Edit this ${noun}'s details.`}</DialogDescription>
        </DialogHeader>

        {imageField ? (
          <div className="grid min-h-0 flex-1 lg:grid-cols-[2fr_3fr]">
            {/* Picture */}
            <div className="min-h-0 space-y-4 overflow-y-auto bg-secondary p-5">
              {(() => {
                const field = fields.find((f) => f.name === imageField);
                return (
                  <>
                    {field && <p className={labelClass}>{field.label}</p>}
                    <ImagePicker value={String(asRecord(draft)[imageField] ?? "")} onChange={(v) => set(imageField, v)} aspect={imageAspect} />
                    {field?.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
                  </>
                );
              })()}
            </div>
            {/* Details */}
            <div className="min-h-0 overflow-y-auto border-t border-border p-5 lg:border-l lg:border-t-0">{details}</div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto p-5">{details}</div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card p-4">
          {isNew || !canDelete ? (
            <span />
          ) : (
            <button type="button" onClick={onDelete} className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" /> Delete {noun}
            </button>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : isNew ? `Add ${noun}` : "Save changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Inputs                                                              */
/* ------------------------------------------------------------------ */

function FieldControl<T>({ field, draft, onChange }: { field: CatalogField<T>; draft: T; onChange: (value: unknown) => void }) {
  const value = asRecord(draft)[field.name];
  const id = `field-${field.name}`;
  const type = field.type ?? "text";

  let control: ReactNode;

  if (type === "textarea") {
    control = <textarea id={id} rows={field.rows ?? 4} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} className={inputClass} />;
  } else if (type === "list") {
    const list = (value as string[] | undefined) ?? [];
    control = (
      <>
        <textarea
          id={id}
          rows={field.rows ?? 6}
          value={list.join("\n")}
          onChange={(e) => onChange(e.target.value.split("\n").filter((l) => l.trim().length > 0))}
          className={inputClass}
        />
        <span className="mt-1 block text-xs text-muted-foreground">
          {list.length} {list.length === 1 ? "item" : "items"}
        </span>
      </>
    );
  } else if (type === "select") {
    const current = String(value ?? "");
    const options = field.options ?? [];
    control = (
      <div className="flex items-center gap-3">
        <select id={id} value={current} onChange={(e) => onChange(e.target.value)} className={inputClass}>
          <option value="">Choose…</option>
          {/* A stored value that isn't one of the options stays visible instead of showing as blank. */}
          {current && !options.includes(current) && <option value={current}>{current} (current value)</option>}
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        {field.preview?.(draft)}
      </div>
    );
  } else if (type === "multiselect") {
    const selected = String(value ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    control = (
      <div className="mt-2 flex flex-wrap gap-2">
        {(field.options ?? []).map((opt) => {
          const on = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange((on ? selected.filter((s) => s !== opt) : [...selected, opt]).join(", "))}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-bold",
                on ? "border-primary-deep bg-primary-deep text-primary-foreground" : "border-border hover:bg-primary-soft",
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>
    );
  } else if (type === "boolean") {
    control = (
      <button
        type="button"
        id={id}
        onClick={() => onChange(!value)}
        className={cn(
          "mt-2 inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold",
          value ? "border-accent bg-accent text-accent-foreground" : "border-border hover:bg-primary-soft",
        )}
      >
        {value ? "Yes" : "No"}
      </button>
    );
  } else if (type === "date") {
    control = <input id={id} type="date" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} className={inputClass} />;
  } else if (type === "number") {
    control = <NumberInput id={id} value={Number(value ?? 0)} onChange={onChange} />;
  } else if (type === "image") {
    control = <ImagePicker compact value={String(value ?? "")} onChange={onChange} aspect="landscape" />;
  } else if (type === "video") {
    control = <VideoField id={id} value={String(value ?? "")} onChange={(v) => onChange(v)} />;
  } else if (type === "country") {
    control = <CountryField id={id} value={String(value ?? "")} onChange={(v) => onChange(v)} />;
  } else {
    control = <input id={id} type="text" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} className={inputClass} />;
  }

  return (
    <div className="text-sm">
      <label htmlFor={id} className={labelClass}>
        {field.label}
      </label>
      {control}
      {field.help && <p className="mt-1.5 text-xs text-muted-foreground">{field.help}</p>}
    </div>
  );
}

/** Number box you can clear while typing (an empty box is saved as 0). */
function NumberInput({ id, value, onChange }: { id: string; value: number; onChange: (value: number) => void }) {
  const [text, setText] = useState(Number.isFinite(value) ? String(value) : "");
  return (
    <input
      id={id}
      type="number"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(e.target.value === "" ? 0 : Number(e.target.value));
      }}
      className={cn(inputClass, "max-w-[10rem]")}
    />
  );
}

/**
 * Picture picker: a preview, a box for a link or built-in key, and the Media Library grid.
 * `compact` shrinks the preview for secondary pictures (like a mobile photo).
 */
export function ImagePicker({
  value,
  onChange,
  aspect,
  compact = false,
}: {
  value: string;
  onChange: (value: string) => void;
  aspect: Aspect;
  compact?: boolean;
}) {
  const media = useCollection("mediaLibrary");
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-3">
      <div className={cn("flex gap-3", compact ? "mt-2 items-start" : "flex-col")}>
        <div
          className={cn(
            "overflow-hidden rounded-xl border border-border bg-card",
            compact ? "aspect-[16/10] w-28 shrink-0" : cn("mx-auto w-full", ASPECT_CLASS[aspect], PREVIEW_WIDTH[aspect]),
          )}
        >
          <CmsImage src={value} alt="" className="h-full w-full object-cover" />
        </div>

        <div className={cn("min-w-0 space-y-2", compact && "flex-1")}>
          <div className="flex gap-2">
            <input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Paste an image link or key"
              className="w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            {value && (
              <button
                type="button"
                aria-label="Clear image"
                onClick={() => onChange("")}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-primary-soft"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
            {open ? "Hide Media Library" : "Choose from Media Library"}
          </Button>
        </div>
      </div>

      {open && (
        <div className="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto rounded-xl border border-border bg-card p-2 sm:grid-cols-4">
          {media.length === 0 && (
            <p className="col-span-full p-3 text-xs text-muted-foreground">
              No images in the Media Library yet.{" "}
              <Link to="/admin/media" className="font-semibold text-primary-deep underline">
                Upload one
              </Link>
              .
            </p>
          )}
          {media.map((m) => (
            <button
              key={m.id}
              type="button"
              title={m.filename}
              onClick={() => onChange(m.url)}
              className={cn(
                "aspect-square overflow-hidden rounded-lg border-2 bg-secondary",
                value === m.url ? "border-accent" : "border-transparent hover:border-primary/40",
              )}
            >
              <img src={m.url} alt={m.filename} loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}