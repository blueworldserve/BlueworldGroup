import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { ChevronDown, Mail, RefreshCw } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { MessageBubble, fullWhen } from "@/components/admin/inbox-parts";
import { ENDPOINTS, apiErrorDetail, apiFetch } from "@/lib/api";
import { formatInterviewDate, titleCase } from "@/lib/application-emails";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/responses")({
  head: () => ({
    meta: [{ title: "Responses — Blue World CMS" }, { name: "robots", content: "noindex" }],
  }),
  component: ResponsesPage,
});

interface ApplicantResponse {
  id: string;
  applicationId: string;
  fullName: string;
  email: string;
  roleTitle: string | null;
  decision: "approved" | "declined";
  interviewDate: string | null;
  fromEmail: string;
  subject: string;
  body: string;
  receivedAt: string;
  isRead: boolean;
}

function ResponsesPage() {
  const [rows, setRows] = useState<ApplicantResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await apiFetch<ApplicantResponse[]>(ENDPOINTS.adminResponses));
    } catch (err) {
      toast.error("Could not load responses", { description: apiErrorDetail(err, "Please try again.") });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function checkNow() {
    setChecking(true);
    try {
      const r = await apiFetch<{ new: number; checked: number }>(`${ENDPOINTS.adminResponses}/check`, { method: "POST" }, 60_000);
      toast.success(r.new ? `${r.new} new repl${r.new === 1 ? "y" : "ies"}` : "No new replies");
      await load();
    } catch (err) {
      toast.error("Could not check the mailbox", { description: apiErrorDetail(err, "Please try again.") });
    } finally {
      setChecking(false);
    }
  }

  function toggle(r: ApplicantResponse) {
    setOpenId((cur) => (cur === r.id ? null : r.id));
    if (!r.isRead) {
      setRows((all) => all.map((x) => (x.id === r.id ? { ...x, isRead: true } : x)));
      void apiFetch(`${ENDPOINTS.adminResponses}/${r.id}/read`, { method: "POST" }).catch(() => {});
    }
  }

  const unread = rows.filter((r) => !r.isRead).length;
  const shown = useMemo(() => (unreadOnly ? rows.filter((r) => !r.isRead) : rows), [rows, unreadOnly]);

  return (
    <AdminShell
      title="Responses"
      description="Replies from applicants to their approval or rejection letters."
      actions={
        <button
          type="button"
          onClick={() => void checkNow()}
          disabled={checking}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-bold text-accent-foreground disabled:opacity-60"
        >
          <RefreshCw className={cn("h-4 w-4", checking && "animate-spin")} />
          {checking ? "Checking…" : "Check for replies"}
        </button>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {[
          { label: `All (${rows.length})`, value: false },
          { label: `Unread (${unread})`, value: true },
        ].map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => setUnreadOnly(t.value)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-xs font-bold",
              unreadOnly === t.value ? "border-primary-deep bg-primary-deep text-primary-foreground" : "border-border text-foreground/75",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Loading…</p>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-card">
          <p className="font-display text-lg font-bold text-primary-deep">No replies yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            When an applicant replies to their letter, it shows up here. The mailbox is checked automatically every few minutes.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {shown.map((r) => {
            const open = openId === r.id;
            const reSubject = /^re:/i.test(r.subject) ? r.subject : `Re: ${r.subject}`;
            return (
              <li key={r.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                <button type="button" onClick={() => toggle(r)} className="flex w-full items-start gap-3 p-4 text-left">
                  <span className={cn("mt-2 h-2.5 w-2.5 shrink-0 rounded-full", r.isRead ? "bg-transparent" : "bg-accent")} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className={cn("text-sm text-primary-deep", !r.isRead && "font-bold")}>{titleCase(r.fullName)}</span>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-wide",
                          r.decision === "approved" ? "bg-emerald-100 text-emerald-800" : "bg-secondary text-muted-foreground",
                        )}
                      >
                        {r.decision}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {r.roleTitle ?? "Application"} · {fullWhen(r.receivedAt)}
                    </span>
                    {!open && <span className="mt-1.5 line-clamp-2 block text-sm text-foreground/80">{r.body}</span>}
                  </span>
                  <ChevronDown className={cn("mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
                </button>

                {open && (
                  <div className="space-y-4 border-t border-border p-4">
                    <dl className="grid grid-cols-[64px_1fr] gap-x-3 gap-y-1 text-sm">
                      <dt className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">From</dt>
                      <dd className="min-w-0 break-words">{r.fromEmail}</dd>
                      {r.interviewDate && (
                        <>
                          <dt className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Interview</dt>
                          <dd>{formatInterviewDate(r.interviewDate)}</dd>
                        </>
                      )}
                    </dl>
                    <MessageBubble>{r.body}</MessageBubble>
                    <a
                      href={`mailto:${r.email}?subject=${encodeURIComponent(reSubject)}`}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-5 py-2 text-sm font-semibold text-foreground/80 hover:bg-primary-soft"
                    >
                      <Mail className="h-4 w-4" /> Reply by email
                    </a>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </AdminShell>
  );
}
