import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { AppIcon } from "@/components/admin/app-icon";
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
import { useCollection } from "@/lib/cms-store";
import {
  appErrorMessage,
  appHost,
  deleteCompanyApp,
  loadCompanyApps,
  normaliseAppUrl,
  saveCompanyApp,
  useCompanyApps,
  type CompanyApp,
} from "@/lib/company-apps";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/apps")({
  head: () => ({
    meta: [
      { title: "Company Apps | Blueworld CMS" },
      { name: "description", content: "The apps and websites owned by Blueworld, shown in the apps menu at the top of the CMS." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CompanyAppsAdmin,
});

const inputClass = "mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
const labelClass = "text-xs font-bold uppercase tracking-[0.14em] text-accent";

type Draft = { id: string | null; name: string; url: string; description: string; icon: string };
const blank: Draft = { id: null, name: "", url: "", description: "", icon: "" };

function CompanyAppsAdmin() {
  const { apps, status } = useCompanyApps();
  const [editing, setEditing] = useState<Draft | null>(null);
  const [toDelete, setToDelete] = useState<CompanyApp | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Always show the latest list when this page opens.
  useEffect(() => {
    void loadCompanyApps(true);
  }, []);

  async function move(id: string, dir: -1 | 1) {
    const from = apps.findIndex((a) => a.id === id);
    const to = from + dir;
    if (from < 0 || to < 0 || to >= apps.length) return;
    const next = [...apps];
    [next[from], next[to]] = [next[to]!, next[from]!];
    try {
      // Renumber everything so the order stays clean even if old numbers had gaps or ties.
      await Promise.all(
        next.map((a, i) =>
          a.order === i
            ? null
            : saveCompanyApp(a.id, { name: a.name, url: a.url, description: a.description, icon: a.icon, order: i }),
        ),
      );
    } catch (error) {
      toast.error(appErrorMessage(error));
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteCompanyApp(toDelete.id);
      toast.success(`${toDelete.name} removed from the apps menu`);
      setToDelete(null);
    } catch (error) {
      toast.error(appErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AdminShell
      title="Company Apps"
      description="Every app and website Blueworld owns. They appear in the apps menu at the top of the CMS."
    >
      <WriteGate resource="company-apps">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-primary-deep">
            All apps <span className="font-normal text-muted-foreground">· {apps.length}</span>
          </h2>
          <Button onClick={() => setEditing({ ...blank })}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add app
          </Button>
        </div>

        {status === "loading" && apps.length === 0 && (
          <p className="rounded-2xl border border-border bg-card p-6 text-sm text-foreground/60">Loading apps…</p>
        )}
        {status === "error" && apps.length === 0 && (
          <p className="rounded-2xl border border-border bg-card p-6 text-sm text-foreground/60">
            Could not load the apps. Check your connection and refresh the page.
          </p>
        )}
        {status === "ready" && apps.length === 0 && (
          <p className="rounded-2xl border border-border bg-card p-6 text-sm text-foreground/60">
            No apps yet. Click “Add app” to add the first one, then open the grid button at the top of the page to see it.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {apps.map((app, index) => (
            <div key={app.id} className="flex flex-col rounded-2xl border border-border bg-card p-4 shadow-card">
              <div className="flex items-start gap-3">
                <AppIcon name={app.name} icon={app.icon} className="h-12 w-12 text-lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-base font-bold text-primary-deep">{app.name}</p>
                  <a
                    href={app.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex max-w-full items-center gap-1 text-xs font-semibold text-accent hover:underline"
                  >
                    <span className="truncate">{appHost(app.url)}</span>
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </div>
              </div>
              {app.description && <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{app.description}</p>}

              <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
                <div className="flex gap-1">
                  <IconButton label="Move earlier" disabled={index === 0} onClick={() => void move(app.id, -1)}>
                    <ArrowLeft className="h-4 w-4" />
                  </IconButton>
                  <IconButton label="Move later" disabled={index === apps.length - 1} onClick={() => void move(app.id, 1)}>
                    <ArrowRight className="h-4 w-4" />
                  </IconButton>
                </div>
                <div className="flex gap-1">
                  <IconButton
                    label={`Edit ${app.name}`}
                    onClick={() =>
                      setEditing({
                        id: app.id,
                        name: app.name,
                        url: app.url,
                        description: app.description ?? "",
                        icon: app.icon ?? "",
                      })
                    }
                  >
                    <Pencil className="h-4 w-4" />
                  </IconButton>
                  <IconButton label={`Remove ${app.name}`} danger onClick={() => setToDelete(app)}>
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
              </div>
            </div>
          ))}
        </div>

        {editing && (
          <AppDialog
            key={editing.id ?? "new"}
            draft={editing}
            nextOrder={apps.length}
            currentOrder={apps.find((a) => a.id === editing.id)?.order}
            onClose={() => setEditing(null)}
          />
        )}

        <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && !deleting && setToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove this app?</AlertDialogTitle>
              <AlertDialogDescription>
                {toDelete?.name ?? "This app"} will disappear from the apps menu. The app itself is not touched, only the shortcut.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button onClick={() => setToDelete(null)} disabled={deleting}>
                Keep it
              </Button>
              <Button variant="destructive" onClick={() => void confirmDelete()} disabled={deleting}>
                {deleting ? "Removing…" : "Remove app"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </WriteGate>
    </AdminShell>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground transition-colors disabled:opacity-40",
        danger ? "hover:border-destructive/50 hover:text-destructive" : "hover:bg-primary-soft",
      )}
    >
      {children}
    </button>
  );
}

function AppDialog({
  draft,
  nextOrder,
  currentOrder,
  onClose,
}: {
  draft: Draft;
  nextOrder: number;
  currentOrder: number | undefined;
  onClose: () => void;
}) {
  const media = useCollection("mediaLibrary");
  const isNew = draft.id === null;
  const [name, setName] = useState(draft.name);
  const [url, setUrl] = useState(draft.url);
  const [description, setDescription] = useState(draft.description);
  const [icon, setIcon] = useState(draft.icon);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    const cleanName = name.trim();
    const cleanUrl = normaliseAppUrl(url);
    if (!cleanName) return void toast.error("Give the app a name.");
    if (!cleanUrl) return void toast.error("Paste the app's link.");
    if (!/^https?:\/\/\S+$/i.test(cleanUrl)) return void toast.error("The link must start with http:// or https://");

    setSaving(true);
    try {
      await saveCompanyApp(draft.id, {
        name: cleanName,
        url: cleanUrl,
        description: description.trim() || null,
        icon: icon.trim() || null,
        order: currentOrder ?? nextOrder,
      });
      toast.success(isNew ? `${cleanName} added to the apps menu` : "Saved");
      onClose();
    } catch (error) {
      toast.error(appErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-h-[92dvh] w-[96vw] max-w-lg gap-0 overflow-y-auto p-0">
        <DialogHeader className="border-b border-border p-5 text-left">
          <DialogTitle className="pr-8 font-display text-xl text-primary-deep">{isNew ? "Add app" : "Edit app"}</DialogTitle>
          <DialogDescription>
            {isNew ? "Add an app or website Blueworld owns. It shows up in the apps menu straight away." : "Change how this app appears in the apps menu."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 p-5">
          <div className="flex items-center gap-3 rounded-xl bg-secondary p-3">
            <AppIcon key={icon} name={name || "?"} icon={icon.trim() || null} className="h-12 w-12 text-lg" />
            <p className="min-w-0 truncate text-sm font-semibold text-foreground/80">{name.trim() || "App name"}</p>
          </div>

          <label className="block text-sm">
            <span className={labelClass}>App name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder='e.g. "HR Portal"' className={inputClass} />
          </label>

          <label className="block text-sm">
            <span className={labelClass}>Link</span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onBlur={() => setUrl((v) => normaliseAppUrl(v))}
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="https://hr.blueworld.com"
              className={inputClass}
            />
          </label>

          <label className="block text-sm">
            <span className={labelClass}>Short description (optional)</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} rows={2} className={inputClass} />
            <span className="mt-1 block text-xs text-muted-foreground">Shown when someone hovers over the app.</span>
          </label>

          <div>
            <label className="block text-sm">
              <span className={labelClass}>Icon (optional)</span>
              <input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="Image link, or pick from the Media Library" className={inputClass} />
              <span className="mt-1 block text-xs text-muted-foreground">Without one, the app shows the first letter of its name.</span>
            </label>
            <Button type="button" variant="outline" className="mt-3" onClick={() => setPicking((v) => !v)}>
              {picking ? "Hide Media Library" : "Choose from Media Library"}
            </Button>
            {picking && (
              <div className="mt-3 grid max-h-48 grid-cols-4 gap-2 overflow-y-auto rounded-xl border border-border bg-card p-2">
                {media.length === 0 && <p className="col-span-4 p-3 text-xs text-muted-foreground">No images in the Media Library yet.</p>}
                {media.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    title={m.filename}
                    onClick={() => setIcon(m.url)}
                    className={cn(
                      "aspect-square overflow-hidden rounded-lg border-2 bg-secondary",
                      icon === m.url ? "border-accent" : "border-transparent hover:border-primary/40",
                    )}
                  >
                    <img src={m.url} alt={m.filename} loading="lazy" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border bg-card p-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : isNew ? "Add app" : "Save changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
