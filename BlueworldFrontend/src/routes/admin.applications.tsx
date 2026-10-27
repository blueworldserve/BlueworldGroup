import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { CalendarCheck, Download, Mail, Paperclip, Phone, Trash2 } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { DecisionDialog } from "@/components/admin/decision-dialog";
import { ResumePreview } from "@/components/admin/resume-preview";
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
import { useMe } from "@/hooks/use-me";
import { ApiError, ENDPOINTS, apiFetch, downloadAuthed } from "@/lib/api";
import { formatInterviewDate, titleCase } from "@/lib/application-emails";
import { useCollection } from "@/lib/cms-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/applications")({
  head: () => ({
    meta: [{ title: "Applications — Blue World CMS" }, { name: "robots", content: "noindex" }],
  }),
  component: ApplicationsPage,
});

type Status = "new" | "approved" | "declined";

interface ApplicationRow {
  id: string;
  createdAt: string;
  jobSlug: string;
  fullName: string;
  email: string;
  phone: string | null;
  coverMessage: string | null;
  resumeFilename: string | null;
  resumeSize: number | null;
  status: Status;
  interviewDate: string | null;
  interviewTime: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
  decisionSubject: string | null;
  decisionBody: string | null;
}

const STATUS_LABEL: Record<Status, string> = { new: "New", approved: "Approved", declined: "Declined" };
const STATUS_STYLE: Record<Status, string> = {
  new: "bg-primary-soft text-primary-deep",
  approved: "bg-emerald-100 text-emerald-800",
  declined: "bg-secondary text-muted-foreground",
};

function StatusBadge({ status }: { status: Status }) {
  return <span className={cn("rounded-full px-2.5 py-0.5 text-[0.68rem] font-bold uppercase tracking-wide", STATUS_STYLE[status])}>{STATUS_LABEL[status]}</span>;
}

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ApplicationsPage() {
  const me = useMe();
  const jobs = useCollection("jobPostings");
  const [rows, setRows] = useState<ApplicationRow[] | null>(null);
  const [error, setError] = useState(false);
  const [role, setRole] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<ApplicationRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const allowed = !!me && (me.role === "admin" || me.role === "editor" || me.role === "hr" || me.isSuperuser);

  useEffect(() => {
    if (!allowed) return;
    (async () => {
      try {
        setRows((await apiFetch(ENDPOINTS.adminApplications)) as ApplicationRow[]);
        setError(false);
      } catch {
        setError(true);
      }
    })();
  }, [allowed]);

  const jobTitle = (slug: string) => jobs.find((j) => j.slug === slug)?.title ?? `${slug} (role closed)`;

  // The roles shown on the left: every job in the CMS, plus any role that has applications but was since removed.
  const roles = useMemo(() => {
    const list = jobs.map((j) => ({ slug: j.slug, title: j.title, department: j.department }));
    for (const r of rows ?? []) {
      if (!list.some((j) => j.slug === r.jobSlug)) list.push({ slug: r.jobSlug, title: jobTitle(r.jobSlug), department: "" });
    }
    return list.map((j) => {
      const mine = (rows ?? []).filter((r) => r.jobSlug === j.slug);
      return { ...j, count: mine.length, fresh: mine.filter((r) => r.status === "new").length };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, rows]);

  // "Attempt 2" badge: the same person applying again for the same role.
  const attempts = useMemo(() => {
    const seen = new Map<string, number>();
    const result = new Map<string, number>();
    for (const r of [...(rows ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
      const key = `${r.jobSlug}|${r.email.toLowerCase()}`;
      const n = (seen.get(key) ?? 0) + 1;
      seen.set(key, n);
      result.set(r.id, n);
    }
    return result;
  }, [rows]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows ?? []).filter(
      (r) =>
        (role === "all" || r.jobSlug === role) &&
        (statusFilter === "all" || r.status === statusFilter) &&
        (!q || [r.fullName, r.email, r.phone ?? ""].some((v) => v.toLowerCase().includes(q))),
    );
  }, [rows, role, statusFilter, query]);

  const open = rows?.find((r) => r.id === openId) ?? null;

  function replaceRow(updated: ApplicationRow) {
    setRows((prev) => (prev ?? []).map((r) => (r.id === updated.id ? updated : r)));
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await apiFetch(`${ENDPOINTS.adminApplications}/${toDelete.id}`, { method: "DELETE" });
      setRows((prev) => (prev ?? []).filter((r) => r.id !== toDelete.id));
      if (openId === toDelete.id) setOpenId(null);
      toast.success("Application deleted");
      setToDelete(null);
    } catch {
      toast.error("Could not delete this application.");
    } finally {
      setDeleting(false);
    }
  }

  if (me && !allowed) {
    return (
      <AdminShell title="Applications" description="Admins, editors and HR only.">
        <p className="rounded-2xl border border-border bg-card p-6 text-sm">You don't have access to this section.</p>
      </AdminShell>
    );
  }

  const selectedTitle = role === "all" ? "All applications" : jobTitle(role);

  return (
    <AdminShell title="Applications" description="Job applications, grouped by role. Open one to read it, view the resume, and send a reply.">
      <div className="grid gap-6 lg:grid-cols-[270px_minmax(0,1fr)]">
        {/* Roles */}
        <aside className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
          {[{ slug: "all", title: "All applications", department: "", count: rows?.length ?? 0, fresh: (rows ?? []).filter((r) => r.status === "new").length }, ...roles].map((r) => (
            <button
              key={r.slug}
              type="button"
              onClick={() => setRole(r.slug)}
              className={cn(
                "flex shrink-0 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors lg:shrink",
                role === r.slug ? "border-primary-deep bg-primary-deep text-primary-foreground" : "border-border bg-card hover:bg-primary-soft",
              )}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">{r.title}</span>
                {r.department && <span className={cn("block truncate text-xs", role === r.slug ? "text-primary-foreground/70" : "text-muted-foreground")}>{r.department}</span>}
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                {r.fresh > 0 && (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[0.65rem] font-bold text-accent-foreground">{r.fresh} new</span>
                )}
                <span className={cn("text-xs font-bold", role === r.slug ? "text-primary-foreground/80" : "text-muted-foreground")}>{r.count}</span>
              </span>
            </button>
          ))}
        </aside>

        {/* Applications for the selected role */}
        <section className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold text-primary-deep">
              {selectedTitle} <span className="font-normal text-muted-foreground">· {shown.length}</span>
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {(["all", "new", "approved", "declined"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-bold capitalize",
                    statusFilter === s ? "border-primary-deep bg-primary-deep text-primary-foreground" : "border-border hover:bg-primary-soft",
                  )}
                >
                  {s}
                </button>
              ))}
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, email, phone…"
                className="w-52 rounded-full border border-border bg-background px-4 py-1.5 text-sm"
              />
            </div>
          </div>

          {error && <p className="mb-3 text-sm text-destructive">Could not load applications.</p>}
          {rows === null && !error && <p className="text-sm text-muted-foreground">Loading…</p>}
          {rows !== null && shown.length === 0 && (
            <p className="rounded-2xl border border-border bg-card p-6 text-sm text-foreground/60">
              {rows.length === 0 ? "No applications yet." : "No applications match."}
            </p>
          )}

          <div className="space-y-2.5">
            {shown.map((r) => (
              <div
                key={r.id}
                role="button"
                tabIndex={0}
                onClick={() => setOpenId(r.id)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setOpenId(r.id)}
                className="flex cursor-pointer items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-card transition-colors hover:border-primary/40 hover:bg-primary-soft/40"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary-deep font-display text-base font-bold text-primary-foreground">
                  {titleCase(r.fullName).charAt(0)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-display text-base font-bold text-primary-deep">{titleCase(r.fullName)}</span>
                    {(attempts.get(r.id) ?? 1) > 1 && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[0.65rem] font-bold text-amber-800">Attempt {attempts.get(r.id)}</span>
                    )}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {r.email}
                    {role === "all" && <span> · {jobTitle(r.jobSlug)}</span>}
                  </p>
                </div>
                <div className="hidden shrink-0 items-center gap-3 text-xs text-muted-foreground sm:flex">
                  {r.resumeFilename && (
                    <span title="Resume attached" className="inline-flex items-center gap-1">
                      <Paperclip className="h-3.5 w-3.5" /> Resume
                    </span>
                  )}
                  <span>{new Date(r.createdAt).toLocaleDateString()}</span>
                </div>
                <StatusBadge status={r.status} />
                <button
                  type="button"
                  aria-label={`Delete ${r.fullName}'s application`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setToDelete(r);
                  }}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      {open && (
        <ApplicationDialog
          row={open}
          jobTitle={jobTitle(open.jobSlug)}
          attempt={attempts.get(open.id) ?? 1}
          onClose={() => setOpenId(null)}
          onUpdated={replaceRow}
          onDelete={() => setToDelete(open)}
        />
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && !deleting && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this application?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete ? `${titleCase(toDelete.fullName)}'s application` : "This application"} and their resume will be permanently deleted. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button onClick={() => setToDelete(null)} disabled={deleting}>
              Keep it
            </Button>
            <Button variant="destructive" onClick={() => void confirmDelete()} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete application"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}

/** The applicant popup: details on the left, resume on the right, decision buttons at the bottom. */
function ApplicationDialog({
  row,
  jobTitle,
  attempt,
  onClose,
  onUpdated,
  onDelete,
}: {
  row: ApplicationRow;
  jobTitle: string;
  attempt: number;
  onClose: () => void;
  onUpdated: (row: ApplicationRow) => void;
  onDelete: () => void;
}) {
  const [deciding, setDeciding] = useState<"approve" | "decline" | null>(null);
  const [downloading, setDownloading] = useState(false);
  const decided = row.status !== "new";

  async function download() {
    setDownloading(true);
    try {
      await downloadAuthed(`${ENDPOINTS.adminApplications}/${row.id}/resume`, row.resumeFilename ?? "resume");
    } catch (err) {
      toast.error(err instanceof ApiError && err.status === 403 ? "You don't have access to resumes." : "Could not download this resume.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && !deciding && onClose()}>
        <DialogContent className="flex h-[92vh] w-[96vw] max-w-6xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-border p-5 text-left">
            <div className="flex flex-wrap items-center gap-3 pr-8">
              <DialogTitle className="font-display text-xl text-primary-deep">{titleCase(row.fullName)}</DialogTitle>
              <StatusBadge status={row.status} />
              {attempt > 1 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[0.65rem] font-bold text-amber-800">Attempt {attempt}</span>}
            </div>
            <DialogDescription>
              Applied for <span className="font-semibold text-foreground">{jobTitle}</span> on {new Date(row.createdAt).toLocaleString()}
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(300px,2fr)_3fr]">
            {/* Left: what they filled in */}
            <div className="min-h-0 space-y-5 overflow-y-auto p-5">
              <div className="space-y-2 text-sm">
                <p className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-accent" />
                  <a href={`mailto:${row.email}`} className="break-all underline-offset-2 hover:underline">
                    {row.email}
                  </a>
                </p>
                {row.phone && (
                  <p className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-accent" />
                    <a href={`tel:${row.phone}`} className="underline-offset-2 hover:underline">
                      {row.phone}
                    </a>
                  </p>
                )}
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Why this role?</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{row.coverMessage || "They didn't write a message."}</p>
              </div>

              {decided && (
                <div className="rounded-xl border border-border bg-secondary p-4 text-sm">
                  <p className="font-bold text-primary-deep">
                    {row.status === "approved" ? "Approved" : "Declined"}
                    {row.decidedBy ? ` by ${row.decidedBy}` : ""}
                  </p>
                  {row.decidedAt && <p className="text-xs text-muted-foreground">{new Date(row.decidedAt).toLocaleString()}</p>}
                  {row.status === "approved" && row.interviewDate && (
                    <p className="mt-2 flex items-center gap-2">
                      <CalendarCheck className="h-4 w-4 text-accent" />
                      Interview: {formatInterviewDate(row.interviewDate)}
                      {row.interviewTime ? `, ${row.interviewTime}` : ""}
                    </p>
                  )}
                  {row.decisionBody && (
                    <details className="mt-3">
                      <summary className="cursor-pointer font-semibold text-primary-deep">The email that was sent</summary>
                      <p className="mt-2 text-xs font-semibold">{row.decisionSubject}</p>
                      <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{row.decisionBody}</p>
                    </details>
                  )}
                </div>
              )}
            </div>

            {/* Right: the resume, shown on screen */}
            <div className="flex min-h-0 flex-col border-t border-border bg-secondary lg:border-l lg:border-t-0">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-4 py-2.5">
                <p className="min-w-0 truncate text-sm font-semibold text-primary-deep">
                  {row.resumeFilename ?? "No resume"}
                  {row.resumeSize ? <span className="font-normal text-muted-foreground"> · {formatSize(row.resumeSize)}</span> : null}
                </p>
                {row.resumeFilename && (
                  <Button size="sm" variant="outline" onClick={() => void download()} disabled={downloading}>
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    {downloading ? "Preparing…" : "Download"}
                  </Button>
                )}
              </div>
              <div className="min-h-0 flex-1 p-3">
                <ResumePreview applicationId={row.id} filename={row.resumeFilename} />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card p-4">
            <button type="button" onClick={onDelete} className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" /> Delete application
            </button>
            {decided ? (
              <p className="text-sm text-muted-foreground">A reply has already been sent to this applicant.</p>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => setDeciding("decline")}>
                  Decline
                </Button>
                <Button onClick={() => setDeciding("approve")}>Approve</Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {deciding && (
        <DecisionDialog
          application={row}
          jobTitle={jobTitle}
          kind={deciding}
          onClose={() => setDeciding(null)}
          onDone={(updated) => {
            onUpdated(updated);
            setDeciding(null);
          }}
        />
      )}
    </>
  );
}